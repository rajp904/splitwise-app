// Expenses service.
// Creates, reads, updates, and deletes expenses.
// Every write also creates/updates the corresponding expense_splits rows.

import { SplitType } from '@prisma/client';
import prisma from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { convertToInr } from '../../utils/currency';
import { computeSplits, SplitInput } from './splits';

interface CreateExpenseInput {
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  paidById: string;
  splitType: SplitType;
  expenseDate: Date;
  splits: SplitInput[];
  notes?: string;
  createdById: string;
  importRowIndex?: number;
}

export async function createExpense(input: CreateExpenseInput) {
  // 1. Convert to INR
  const amountInr = await convertToInr(input.amount, input.currency, input.expenseDate);

  // 2. Compute each person's share
  const computedSplits = computeSplits(amountInr, input.splitType, input.splits);

  // 3. Write expense + splits in a transaction so they either both succeed or both fail
  const expense = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.create({
      data: {
        groupId: input.groupId,
        description: input.description.trim(),
        amount: input.amount,
        currency: input.currency,
        amountInr,
        paidById: input.paidById,
        splitType: input.splitType,
        expenseDate: input.expenseDate,
        notes: input.notes,
        importRowIndex: input.importRowIndex,
        createdById: input.createdById,
        splits: {
          createMany: {
            data: computedSplits.map((s) => ({
              userId: s.userId,
              shareValue: s.shareValue,
              computedAmountInr: s.computedAmountInr,
            })),
          },
        },
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true } } } },
        paidBy: { select: { id: true, name: true } },
      },
    });
    return exp;
  });

  return expense;
}

export async function getGroupExpenses(groupId: string, requestingUserId: string) {
  // Verify requester is a member
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: requestingUserId } },
  });
  if (!membership) throw new AppError(403, 'You are not a member of this group');

  return prisma.expense.findMany({
    where: { groupId, isSettlement: false },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { expenseDate: 'desc' },
  });
}

export async function getExpenseById(expenseId: string, requestingUserId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
      anomalies: true,
    },
  });
  if (!expense) throw new AppError(404, 'Expense not found');

  // Verify access
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: expense.groupId, userId: requestingUserId } },
  });
  if (!membership) throw new AppError(403, 'You are not a member of this group');

  return expense;
}

export async function deleteExpense(expenseId: string, requestingUserId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new AppError(404, 'Expense not found');

  // Only the person who created the expense can delete it
  if (expense.createdById !== requestingUserId) {
    throw new AppError(403, 'Only the expense creator can delete it');
  }

  // Cascade deletes splits via Prisma schema
  await prisma.expense.delete({ where: { id: expenseId } });
}

interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  currency?: string;
  paidById?: string;
  splitType?: SplitType;
  expenseDate?: Date;
  splits?: SplitInput[];
  notes?: string;
}

export async function updateExpense(
  expenseId: string,
  input: UpdateExpenseInput,
  requestingUserId: string
) {
  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) throw new AppError(404, 'Expense not found');
  if (existing.createdById !== requestingUserId) {
    throw new AppError(403, 'Only the expense creator can edit it');
  }

  // Determine final values — fall back to existing values for unchanged fields
  const amount   = input.amount   ?? Number(existing.amount);
  const currency = input.currency ?? existing.currency;
  const paidById = input.paidById ?? existing.paidById;
  const splitType = (input.splitType ?? existing.splitType) as SplitType;
  const expenseDate = input.expenseDate ?? existing.expenseDate;

  const amountInr = await convertToInr(amount, currency, expenseDate);

  // If splits changed, recompute; otherwise keep existing
  const updatedExpense = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.update({
      where: { id: expenseId },
      data: {
        description: input.description?.trim() ?? existing.description,
        amount,
        currency,
        amountInr,
        paidById,
        splitType,
        expenseDate,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
    });

    if (input.splits && input.splits.length > 0) {
      // Delete old splits and recompute
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      const computedSplits = computeSplits(amountInr, splitType, input.splits);
      await tx.expenseSplit.createMany({
        data: computedSplits.map((s) => ({
          expenseId,
          userId: s.userId,
          shareValue: s.shareValue,
          computedAmountInr: s.computedAmountInr,
        })),
      });
    }

    return tx.expense.findUnique({
      where: { id: expenseId },
      include: {
        splits: { include: { user: { select: { id: true, name: true } } } },
        paidBy: { select: { id: true, name: true } },
      },
    });
  });

  return updatedExpense;
}
