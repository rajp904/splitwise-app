// Report builder — Step 4 of the import pipeline.
// Assembles the import report that the frontend displays.
// Also used for the downloadable report deliverable.

import prisma from '../../config/prisma';

export interface ImportReport {
  sessionId: string;
  filename: string;
  importedAt: string;
  status: string;
  summary: {
    totalRows: number;
    imported: number;
    skipped: number;
    pending: number;
    errors: number;
    anomalies: number;
  };
  anomalies: Array<{
    rowIndex: number;
    csvRow: Record<string, unknown>;
    anomalyCode: string;
    severity: string;
    description: string;
    policy: string;
    actionTaken: string;
  }>;
}

export async function buildImportReport(sessionId: string): Promise<ImportReport> {
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    include: {
      anomalies: { orderBy: { rowIndex: 'asc' } },
    },
  });

  if (!session) throw new Error(`Import session ${sessionId} not found`);

  return {
    sessionId: session.id,
    filename: session.filename,
    importedAt: session.importedAt.toISOString(),
    status: session.status,
    summary: {
      totalRows: session.rowCount,
      imported: session.importedCount,
      skipped: session.skippedCount,
      pending: session.anomalyCount, // anomalyCount tracks pending rows in session
      errors: session.anomalies.filter((a) => a.severity === 'error').length,
      anomalies: session.anomalies.length,
    },
    anomalies: session.anomalies.map((a) => ({
      rowIndex: a.rowIndex,
      csvRow: a.rawRow as Record<string, unknown>,
      anomalyCode: a.anomalyCode,
      severity: a.severity,
      description: a.description,
      policy: a.resolutionPolicy,
      actionTaken: a.actionTaken,
    })),
  };
}
