import { apiClient } from './client'

export interface Expense {
  id: string
  name: string
  pricePerUnit: number
  units: number
  total: number
  date: string
  productLink?: string
  payee: string
  createdAt: string
  updatedAt: string
}

export interface Income {
  id: string
  amount: number
  date: string
  concept: string
  createdAt: string
  updatedAt: string
}

export interface MonthSummary {
  month: string
  monthKey: string
  expenses: number
  income: number
  balance: number
}

export interface AccountingSummary {
  year: number
  byMonth: MonthSummary[]
  yearTotal: { expenses: number; income: number; balance: number }
  availableYears: number[]
}

export const accountingApi = {
  // Expenses
  getExpenses: async (): Promise<Expense[]> => {
    try {
      const { data } = await apiClient.get<Expense[]>('/accounting/expenses')
      return data
    } catch {
      return []
    }
  },

  createExpense: async (data: Omit<Expense, 'id' | 'total' | 'createdAt' | 'updatedAt'>): Promise<Expense> => {
    const { data: created } = await apiClient.post<Expense>('/accounting/expenses', data)
    return created
  },

  updateExpense: async (id: string, data: Partial<Expense>): Promise<Expense> => {
    const { data: updated } = await apiClient.put<Expense>(`/accounting/expenses/${id}`, data)
    return updated
  },

  deleteExpense: async (id: string): Promise<void> => {
    await apiClient.delete(`/accounting/expenses/${id}`)
  },

  // Incomes
  getIncomes: async (): Promise<Income[]> => {
    try {
      const { data } = await apiClient.get<Income[]>('/accounting/incomes')
      return data
    } catch {
      return []
    }
  },

  createIncome: async (data: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>): Promise<Income> => {
    const { data: created } = await apiClient.post<Income>('/accounting/incomes', data)
    return created
  },

  updateIncome: async (id: string, data: Partial<Income>): Promise<Income> => {
    const { data: updated } = await apiClient.put<Income>(`/accounting/incomes/${id}`, data)
    return updated
  },

  deleteIncome: async (id: string): Promise<void> => {
    await apiClient.delete(`/accounting/incomes/${id}`)
  },

  // Summary
  getSummary: async (year?: number): Promise<AccountingSummary> => {
    const params = year ? `?year=${year}` : ''
    const { data } = await apiClient.get<AccountingSummary>(`/accounting/summary${params}`)
    return data
  },
}
