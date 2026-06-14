import { apiClient } from './client';
import type { ImportReport } from '../types';

export const importApi = {
  uploadCsv: (groupId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<{ sessionId: string; report: ImportReport }>(`/groups/${groupId}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getReport: (groupId: string, sessionId: string) =>
    apiClient.get<ImportReport>(`/groups/${groupId}/import/${sessionId}`).then((r) => r.data),
};
