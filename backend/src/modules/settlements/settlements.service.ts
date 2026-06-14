// Settlements service.
// A settlement records that one person paid another to clear a debt.
// It affects the balance calculation but is NOT an expense.

import prisma from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { convertToInr } from '../../utils/currency';

interface CreateSettlementInput {
  groupId: string;
  paidById: string;
  paidToId: string;
  amount: number;
  currency: string;
  settlementDate: Date;
  notes?: string;
  createdById: string;
}

export async function createSettlement(input: CreateSettlementInput) {
  // Validate both users are members of the group
  const [payerMembership, payeeMembership] = await Promise.all([
    prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: input.paidById } },
    }),
    prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: input.paidToId } },
    }),
  ]);

  if (!payerMembership) throw new AppError(400, 'Payer is not a member of this group');
  if (!payeeMembership) throw new AppError(400, 'Payee is not a member of this group');
  if (input.paidById === input.paidToId) throw new AppError(400, 'Cannot settle with yourself');

  const amountInr = await convertToInr(input.amount, input.currency, input.settlementDate);

  return prisma.settlement.create({
    data: {
      groupId: input.groupId,
      paidById: input.paidById,
      paidToId: input.paidToId,
      amount: input.amount,
      currency: input.currency,
      amountInr,
      settlementDate: input.settlementDate,
      notes: input.notes,
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      paidTo: { select: { id: true, name: true } },
    },
  });
}

export async function getGroupSettlements(groupId: string, requestingUserId: string) {
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: requestingUserId } },
  });
  if (!membership) throw new AppError(403, 'You are not a member of this group');

  return prisma.settlement.findMany({
    where: { groupId },
    include: {
      paidBy: { select: { id: true, name: true } },
      paidTo: { select: { id: true, name: true } },
    },
    orderBy: { settlementDate: 'desc' },
  });
}
