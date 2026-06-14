// Shared TypeScript types used across the frontend.
// These mirror the backend API response shapes.

export interface User {
  id: string;
  name: string;
  email: string;
  isGuest?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface GroupMembership {
  id: string;
  userId: string;
  groupId: string;
  joinedAt: string;
  leftAt: string | null;
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdById: string;
  createdAt: string;
  memberships: GroupMembership[];
  _count?: { expenses: number };
}

export type SplitType = 'equal' | 'unequal' | 'percentage' | 'share';

export interface ExpenseSplit {
  id: string;
  userId: string;
  expenseId: string;
  shareValue: number | null;
  computedAmountInr: number;
  isSettled: boolean;
  user: Pick<User, 'id' | 'name'>;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  amountInr: number;
  paidById: string;
  paidBy: Pick<User, 'id' | 'name'>;
  splitType: SplitType;
  expenseDate: string;
  isSettlement: boolean;
  notes?: string;
  importRowIndex?: number;
  createdAt: string;
  splits: ExpenseSplit[];
}

export interface Settlement {
  id: string;
  groupId: string;
  paidById: string;
  paidToId: string;
  paidBy: Pick<User, 'id' | 'name'>;
  paidTo: Pick<User, 'id' | 'name'>;
  amount: number;
  currency: string;
  amountInr: number;
  settlementDate: string;
  notes?: string;
  createdAt: string;
}

export interface MemberBalance {
  userId: string;
  userName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface DebtTransaction {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

export interface GroupBalances {
  memberBalances: MemberBalance[];
  simplifiedDebts: DebtTransaction[];
}

export interface ImportAnomaly {
  rowIndex: number;
  csvRow: Record<string, string>;
  anomalyCode: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
  policy: string;
  actionTaken: string;
}

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
  anomalies: ImportAnomaly[];
}
