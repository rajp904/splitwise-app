// Balance calculation engine.
// This module has NO database writes — it only reads and computes.
// That separation is intentional: balance logic is pure and testable.
//
// Core concept:
//   net_balance = total_paid - total_owed
//   positive → others owe this person
//   negative → this person owes others
//
// Simplified debts (Aisha's requirement: "one number per person"):
//   We use a greedy algorithm to produce the minimum number of transactions.

import prisma from '../../config/prisma';
import { roundMoney } from '../../utils/rounding';
import { AppError } from '../../middleware/errorHandler';

export interface MemberBalance {
  userId: string;
  userName: string;
  totalPaid: number;     // sum of expense amounts where this person is payer
  totalOwed: number;     // sum of their splits across all expenses
  netBalance: number;    // totalPaid - totalOwed (positive = owed money, negative = owes money)
}

export interface DebtTransaction {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;        // always positive
}

export interface GroupBalances {
  memberBalances: MemberBalance[];
  simplifiedDebts: DebtTransaction[];
}

export async function getGroupBalances(groupId: string, requestingUserId: string): Promise<GroupBalances> {
  // Verify access
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: requestingUserId } },
  });
  if (!membership) throw new AppError(403, 'You are not a member of this group');

  // Get all non-settlement expenses with their splits
  const expenses = await prisma.expense.findMany({
    where: { groupId, isSettlement: false },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  // Get all settlements (payments between members)
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    include: {
      paidBy: { select: { id: true, name: true } },
      paidTo: { select: { id: true, name: true } },
    },
  });

  // Build a map: userId → { paid, owed }
  const balanceMap = new Map<string, { name: string; paid: number; owed: number }>();

  function ensureUser(id: string, name: string) {
    if (!balanceMap.has(id)) {
      balanceMap.set(id, { name, paid: 0, owed: 0 });
    }
  }

  // Accumulate paid amounts
  for (const expense of expenses) {
    ensureUser(expense.paidById, expense.paidBy.name);
    balanceMap.get(expense.paidById)!.paid += Number(expense.amountInr);
  }

  // Accumulate owed amounts from splits
  for (const expense of expenses) {
    for (const split of expense.splits) {
      ensureUser(split.userId, split.user.name);
      balanceMap.get(split.userId)!.owed += Number(split.computedAmountInr);
    }
  }

  // Apply settlements: a settlement reduces what the payer owes and what the receiver is owed
  for (const settlement of settlements) {
    ensureUser(settlement.paidById, settlement.paidBy.name);
    ensureUser(settlement.paidToId, settlement.paidTo.name);
    // Rohan paying Aisha ₹5000: Rohan's debt decreases, Aisha's credit decreases
    balanceMap.get(settlement.paidById)!.paid += Number(settlement.amountInr);
    balanceMap.get(settlement.paidToId)!.owed += Number(settlement.amountInr);
  }

  // Build member balance array
  const memberBalances: MemberBalance[] = Array.from(balanceMap.entries()).map(([userId, data]) => ({
    userId,
    userName: data.name,
    totalPaid: roundMoney(data.paid),
    totalOwed: roundMoney(data.owed),
    netBalance: roundMoney(data.paid - data.owed),
  }));

  // Compute simplified debts
  const simplifiedDebts = simplifyDebts(memberBalances);

  return { memberBalances, simplifiedDebts };
}

/**
 * Greedy debt simplification algorithm.
 * Produces the minimum number of payments to settle all balances.
 *
 * How it works:
 * 1. Separate members into creditors (positive balance) and debtors (negative balance)
 * 2. Repeatedly match the largest debtor with the largest creditor
 * 3. The smaller of the two amounts settles one side; the other continues
 */
function simplifyDebts(balances: MemberBalance[]): DebtTransaction[] {
  const transactions: DebtTransaction[] = [];

  // Work with mutable copies, filtered to non-zero balances
  const creditors = balances
    .filter((b) => b.netBalance > 0.01)
    .map((b) => ({ userId: b.userId, userName: b.userName, amount: b.netBalance }));

  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ userId: b.userId, userName: b.userName, amount: Math.abs(b.netBalance) }));

  // Sort descending so we always process the largest amounts first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let ci = 0; // creditor index
  let di = 0; // debtor index

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const amount = roundMoney(Math.min(creditor.amount, debtor.amount));

    if (amount < 0.01) {
      // Effectively zero — skip
      if (creditor.amount <= debtor.amount) ci++;
      else di++;
      continue;
    }

    transactions.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.userName,
      toUserId: creditor.userId,
      toUserName: creditor.userName,
      amount,
    });

    creditor.amount = roundMoney(creditor.amount - amount);
    debtor.amount = roundMoney(debtor.amount - amount);

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return transactions;
}

export async function getUserBalancesAcrossGroups(userId: string) {
  // Get all groups this user belongs to and their balance in each
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true } } },
  });

  const results = await Promise.all(
    memberships.map(async (m) => {
      const { memberBalances } = await getGroupBalances(m.groupId, userId);
      const myBalance = memberBalances.find((b) => b.userId === userId);
      return {
        group: m.group,
        netBalance: myBalance?.netBalance ?? 0,
      };
    })
  );

  return results;
}
