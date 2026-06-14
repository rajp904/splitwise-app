// Expenses tab — list expenses + create expense form.

import { useEffect, useState } from 'react';
import { expensesApi } from '../../api/expenses';
import type { Expense, Group, SplitType } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface Props { groupId: string; group: Group; }

const SPLIT_TYPES: SplitType[] = ['equal', 'unequal', 'percentage', 'share'];

export function ExpensesTab({ groupId, group }: Props) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    description: '', amount: '', currency: 'INR',
    paidById: user?.id ?? '', splitType: 'equal' as SplitType,
    expenseDate: new Date().toISOString().slice(0, 10), notes: '',
  });
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMembers = group.memberships.filter((m) => !m.leftAt);

  useEffect(() => {
    expensesApi.list(groupId)
      .then(setExpenses)
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setIsLoading(false));
  }, [groupId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.paidById) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const splits = activeMembers.map((m) => ({
        userId: m.userId,
        ...(form.splitType !== 'equal' && { shareValue: parseFloat(splitValues[m.userId] ?? '0') }),
      }));

      const expense = await expensesApi.create(groupId, {
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        paidById: form.paidById,
        splitType: form.splitType,
        expenseDate: form.expenseDate,
        splits,
        notes: form.notes || undefined,
      });
      setExpenses((prev) => [expense, ...prev]);
      setShowForm(false);
      resetForm();
      toast.success('Expense added');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to add expense';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setForm({ description: '', amount: '', currency: 'INR', paidById: user?.id ?? '',
      splitType: 'equal', expenseDate: new Date().toISOString().slice(0, 10), notes: '' });
    setSplitValues({});
  }

  async function handleDelete(expenseId: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesApi.delete(groupId, expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      toast.success('Expense deleted');
    } catch {
      toast.error('Cannot delete this expense');
    }
  }

  if (isLoading) return <div className="py-10 text-center text-gray-400">Loading expenses...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-medium text-gray-900">New Expense</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Description *" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Electricity bill" />
            <div className="flex gap-2">
              <Input label="Amount *" type="number" value={form.amount} className="flex-1"
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="1200" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Currency</label>
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option>INR</option><option>USD</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Paid by *</label>
              <select value={form.paidById} onChange={(e) => setForm((f) => ({ ...f, paidById: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select person</option>
                {activeMembers.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Split type</label>
              <select value={form.splitType} onChange={(e) => setForm((f) => ({ ...f, splitType: e.target.value as SplitType }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {SPLIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Date *" type="date" value={form.expenseDate}
              onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} />
            <Input label="Notes" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>

          {/* Per-person split values for non-equal splits */}
          {form.splitType !== 'equal' && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                {form.splitType === 'percentage' ? 'Percentages (must sum to 100)' :
                 form.splitType === 'share' ? 'Share units' : 'Fixed amounts (must sum to total)'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeMembers.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2">
                    <span className="w-24 truncate text-sm text-gray-700">{m.user.name}</span>
                    <input type="number" step="0.01" value={splitValues[m.userId] ?? ''}
                      onChange={(e) => setSplitValues((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>Save Expense</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Expenses list */}
      {expenses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
          No expenses yet
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div key={expense.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                    <Badge label={expense.splitType} color="blue" />
                    {expense.currency !== 'INR' && <Badge label={expense.currency} color="yellow" />}
                    {expense.importRowIndex != null && <Badge label="imported" color="gray" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}Paid by {expense.paidBy.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900">
                    {expense.currency !== 'INR'
                      ? `$${Number(expense.amount).toLocaleString()}`
                      : `₹${Number(expense.amountInr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  </p>
                  {expense.currency !== 'INR' && (
                    <p className="text-xs text-gray-400">≈ ₹{Number(expense.amountInr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                    className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Expand">
                    {expandedId === expense.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expense.paidBy.id === user?.id && (
                    <button onClick={() => handleDelete(expense.id)}
                      className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded split details — Rohan's requirement */}
              {expandedId === expense.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  {expense.notes && <p className="mb-2 text-xs text-gray-500 italic">"{expense.notes}"</p>}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400">
                        <th className="pb-1 font-medium">Person</th>
                        <th className="pb-1 font-medium text-right">Owes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expense.splits.map((split) => (
                        <tr key={split.id} className="border-t border-gray-100">
                          <td className="py-1 text-gray-700">{split.user.name}</td>
                          <td className="py-1 text-right font-medium text-gray-900">
                            ₹{Number(split.computedAmountInr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
