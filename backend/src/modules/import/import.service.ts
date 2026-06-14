// Import service — orchestrates the full import pipeline.
// Calls: parser → validator → guest-user-creation → resolver → session update → report

import prisma from '../../config/prisma';
import { parseCsv } from './parser';
import { validateRows, KnownUser, MembershipRecord } from './validator';
import { resolveRows } from './resolver';
import { buildImportReport } from './report';
import { AppError } from '../../middleware/errorHandler';

export async function importCsv(
  groupId: string,
  importedById: string,
  filename: string,
  fileBuffer: Buffer
) {
  // ── 1. Parse ──────────────────────────────────────────────────────────────
  const rawRows = await parseCsv(fileBuffer);

  // ── 2. Load group members for validation ──────────────────────────────────
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true } } },
  });

  const knownUsers: KnownUser[] = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
  }));

  const membershipRecords: MembershipRecord[] = memberships.map((m) => ({
    userId: m.userId,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
  }));

  // Infer context year from the rows (take the most common year in dates)
  const contextYear = inferContextYear(rawRows.map((r) => r.date));

  // ── 3. Validate ───────────────────────────────────────────────────────────
  const validatedRows = validateRows(rawRows, knownUsers, membershipRecords, contextYear);

  // ── 4. Create import session ──────────────────────────────────────────────
  const session = await prisma.importSession.create({
    data: {
      groupId,
      filename,
      importedById,
      rowCount: rawRows.length,
      status: 'pending',
    },
  });

  // ── 5. Create guest users for unknown members ──────────────────────────────
  const guestUserMap = await createGuestUsers(validatedRows, groupId, memberships.map((m) => m.user));

  // ── 6. Resolve rows (writes to DB) ────────────────────────────────────────
  const resolvedRows = await resolveRows({
    sessionId: session.id,
    groupId,
    importedById,
    rows: validatedRows,
    guestUserMap,
  });

  // ── 7. Update session stats ───────────────────────────────────────────────
  const importedCount = resolvedRows.filter((r) => r.action === 'imported').length;
  const skippedCount = resolvedRows.filter((r) => r.action === 'skipped').length;
  const pendingCount = resolvedRows.filter((r) => r.action === 'pending').length;
  const errorCount = resolvedRows.filter((r) => r.action === 'error').length;

  await prisma.importSession.update({
    where: { id: session.id },
    data: {
      status: pendingCount > 0 || errorCount > 0 ? 'pending' : 'complete',
      importedCount,
      skippedCount,
      anomalyCount: pendingCount,
    },
  });

  // ── 8. Build and return report ────────────────────────────────────────────
  const report = await buildImportReport(session.id);
  return { sessionId: session.id, report, resolvedRows };
}

export async function getImportReport(sessionId: string, requestingUserId: string) {
  const session = await prisma.importSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Import session not found');

  // Verify the requesting user belongs to the group
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: session.groupId, userId: requestingUserId } },
  });
  if (!membership) throw new AppError(403, 'Access denied');

  return buildImportReport(sessionId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function inferContextYear(dateStrings: string[]): number {
  const years: number[] = [];
  for (const s of dateStrings) {
    const match = s.match(/\d{4}/);
    if (match) years.push(parseInt(match[0], 10));
  }
  if (years.length === 0) return new Date().getFullYear();

  // Return the most common year
  const freq = new Map<number, number>();
  for (const y of years) freq.set(y, (freq.get(y) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function createGuestUsers(
  rows: ReturnType<typeof validateRows>,
  groupId: string,
  existingUsers: Array<{ id: string; name: string }>
): Promise<Map<string, string>> {
  const guestMap = new Map<string, string>(); // normalisedName.toLowerCase() → userId
  const existingNames = new Set(existingUsers.map((u) => u.name.toLowerCase()));

  // Collect all unique unknown member names
  const unknownNames = new Set<string>();
  for (const row of rows) {
    for (const anomaly of row.anomalies) {
      if (anomaly.anomalyCode === 'A06_UNKNOWN_MEMBER' && anomaly.suggestedFix) {
        const fix = anomaly.suggestedFix as { createGuest: boolean; name: string };
        if (fix.createGuest && fix.name && !existingNames.has(fix.name.toLowerCase())) {
          unknownNames.add(fix.name);
        }
      }
    }
  }

  // Create guest users and add them to the group
  for (const name of unknownNames) {
    // Check if already in DB (from a previous import)
    let user = await prisma.user.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, isGuest: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email: `guest-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@imported.local`,
          passwordHash: 'GUEST_NO_LOGIN',
          isGuest: true,
        },
      });
    }

    // Add to group if not already a member
    const existing = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });
    if (!existing) {
      await prisma.groupMembership.create({
        data: { groupId, userId: user.id, joinedAt: new Date() },
      });
    }

    guestMap.set(name.toLowerCase(), user!.id);

    // Also update matching validated rows so the resolver can use the new userId
    for (const row of rows) {
      for (const p of row.parsedParticipants) {
        if (!p.matched && p.raw.toLowerCase().includes(name.toLowerCase())) {
          p.matched = { id: user!.id, name: user!.name };
        }
      }
      if (!row.parsedPayer && row.payerRaw.toLowerCase().includes(name.toLowerCase())) {
        row.parsedPayer = { id: user!.id, name: user!.name };
      }
    }
  }

  return guestMap;
}
