import { apiClient } from './client';
import type { Group, GroupMembership } from '../types';

export const groupsApi = {
  list: () =>
    apiClient.get<Group[]>('/groups').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Group>(`/groups/${id}`).then((r) => r.data),

  create: (name: string, description?: string) =>
    apiClient.post<Group>('/groups', { name, description }).then((r) => r.data),

  addMember: (groupId: string, userId: string, joinedAt: string) =>
    apiClient.post<GroupMembership>(`/groups/${groupId}/members`, { userId, joinedAt }).then((r) => r.data),

  removeMember: (groupId: string, userId: string, leftAt: string) =>
    apiClient.put<GroupMembership>(`/groups/${groupId}/members/${userId}`, { leftAt }).then((r) => r.data),
};
