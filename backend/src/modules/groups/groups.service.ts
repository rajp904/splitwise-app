// Groups service.
// Handles group creation and time-bound membership management.
// "Time-bound" means we track when someone joined and left,
// so balance calculations can filter by membership date.

import prisma from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';

export async function createGroup(name: string, description: string | undefined, createdById: string) {
  // Create the group, then immediately add the creator as a member
  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      description: description?.trim(),
      createdById,
      memberships: {
        create: {
          userId: createdById,
          joinedAt: new Date(),
        },
      },
    },
    include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  return group;
}

export async function getUserGroups(userId: string) {
  return prisma.group.findMany({
    where: {
      memberships: { some: { userId } },
    },
    include: {
      memberships: {
        where: { leftAt: null }, // only active members
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getGroupById(groupId: string, requestingUserId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!group) throw new AppError(404, 'Group not found');

  // Ensure requester is a member (current or past)
  const isMember = group.memberships.some((m) => m.userId === requestingUserId);
  if (!isMember) throw new AppError(403, 'You are not a member of this group');

  return group;
}

export async function addMember(groupId: string, userId: string, joinedAt: Date) {
  // Check group exists
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError(404, 'Group not found');

  // Check user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  // Check for existing active membership
  const existing = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  if (existing && !existing.leftAt) {
    throw new AppError(409, 'User is already an active member of this group');
  }

  if (existing) {
    // Re-joining: update leftAt to null and update joinedAt
    return prisma.groupMembership.update({
      where: { id: existing.id },
      data: { leftAt: null, joinedAt },
    });
  }

  return prisma.groupMembership.create({
    data: { groupId, userId, joinedAt },
  });
}

export async function removeMember(groupId: string, userId: string, leftAt: Date) {
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  if (!membership || membership.leftAt) {
    throw new AppError(404, 'Active membership not found');
  }

  return prisma.groupMembership.update({
    where: { id: membership.id },
    data: { leftAt },
  });
}

export async function getActiveMembers(groupId: string, onDate: Date) {
  return prisma.groupMembership.findMany({
    where: {
      groupId,
      joinedAt: { lte: onDate },
      OR: [{ leftAt: null }, { leftAt: { gt: onDate } }],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
