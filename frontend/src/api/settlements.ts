import { apiClient } from './client';
import type { Settlement } from '../types';

export const settlementsApi = {
  list: (groupId: string) =>
    apiClient.get<Settlement[]>(`/groups/${groupId}/settlements`).then((r) => r.data),

  create: (groupId: string, data: {
    paidById: string;
    paidToId: string;
    amount: number;
    currency?: string;
    settlementDate: string;
    notes?: string;
  }) =>
    apiClient.post<Settlement>(`/groups/${groupId}/settlements`, data).then((r) => r.data),
};
