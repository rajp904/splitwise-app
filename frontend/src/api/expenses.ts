import { apiClient } from './client';
import type { Expense, SplitType } from '../types';

interface CreateExpensePayload {
  description: string;
  amount: number;
  currency: string;
  paidById: string;
  splitType: SplitType;
  expenseDate: string;
  splits: Array<{ userId: string; shareValue?: number }>;
  notes?: string;
}

export const expensesApi = {
  list: (groupId: string) =>
    apiClient.get<Expense[]>(`/groups/${groupId}/expenses`).then((r) => r.data),

  get: (groupId: string, expenseId: string) =>
    apiClient.get<Expense>(`/groups/${groupId}/expenses/${expenseId}`).then((r) => r.data),

  create: (groupId: string, data: CreateExpensePayload) =>
    apiClient.post<Expense>(`/groups/${groupId}/expenses`, data).then((r) => r.data),

  delete: (groupId: string, expenseId: string) =>
    apiClient.delete(`/groups/${groupId}/expenses/${expenseId}`),

  update: (groupId: string, expenseId: string, data: Partial<CreateExpensePayload>) =>
    apiClient.put<Expense>(`/groups/${groupId}/expenses/${expenseId}`, data).then((r) => r.data),
};
