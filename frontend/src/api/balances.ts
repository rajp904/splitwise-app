import { apiClient } from './client';
import type { GroupBalances } from '../types';

export const balancesApi = {
  getGroupBalances: (groupId: string) =>
    apiClient.get<GroupBalances>(`/groups/${groupId}/balances`).then((r) => r.data),
};
