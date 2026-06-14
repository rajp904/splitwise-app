import { apiClient } from './client';
import type { User } from '../types';

export const usersApi = {
  // List all non-guest registered users (for adding to groups)
  list: () =>
    apiClient.get<User[]>('/users').then((r) => r.data),

  // Get exchange rates
  getExchangeRates: () =>
    apiClient.get<Array<{
      id: string;
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      effectiveDate: string;
      source: string;
    }>>('/users/exchange-rates').then((r) => r.data),

  // Set a new exchange rate
  setExchangeRate: (data: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    effectiveDate: string;
  }) =>
    apiClient.post('/users/exchange-rates', data).then((r) => r.data),
};
