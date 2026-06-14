// Settlements tab — list settlements and record new ones.

import { useEffect, useState } from 'react';
import { settlementsApi } from '../../api/settlements';
import type { Settlement, Group } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props { groupId: string; group: Group; }

export function SettlementsTab({ groupId, group }: Props) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    paidById: '', paidToId: '', amount: '',
    currency: 'INR', settlementDate: new Date().toISOString().slice(0, 10), notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMembers = group.memberships.filter((m) => !m.leftAt);

  useEffect(() => {
    settlementsApi.list(groupId)
      .then(setSettlements)
      .catch(() => toast.error('Failed to load settlements'))
      .finally(() => setIsLoading(false));
  }, [groupId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.paidById || !form.paidToId || !form.amount) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const s = await settlementsApi.create(groupId, {
        paidById: form.paidById,
        paidToId: form.paidToId,
        amount: parseFloat(form.amount),
        currency: form.currency,
        settlementDate: form.settlementDate,
        notes: form.notes || undefined,
      });
      setSettlements((prev) => [s, ...prev]);
      setShowForm(false);
      setForm({ paidById: '', paidToId: '', amount: '', currency: 'INR',
        settlementDate: new Date().toISOString().slice(0, 10), notes: '' });
      toast.success('Settlement recorded');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="py-10 text-center text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{settlements.length} payment{settlements.length !== 1 ? 's' : ''} recorded</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-medium text-gray-900">Record a payment</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Who paid?</label>
              <select value={form.paidById} onChange={(e) => setForm((f) => ({ ...f, paidById: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select</option>
                {activeMembers.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Paid to?</label>
              <select value={form.paidToId} onChange={(e) => setForm((f) => ({ ...f, paidToId: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select</option>
                {activeMembers.filter((m) => m.userId !== form.paidById).map((m) =>
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Input label="Amount" type="number" value={form.amount} className="flex-1"
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="5000" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Currency</label>
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option>INR</option><option>USD</option>
                </select>
              </div>
            </div>
            <Input label="Date" type="date" value={form.settlementDate}
              onChange={(e) => setForm((f) => ({ ...f, settlementDate: e.target.value }))} />
            <Input label="Notes" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>Save</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {settlements.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
          No payments recorded yet
        </div>
      ) : (
        <div className="space-y-2">
          {settlements.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  <span className="text-blue-600">{s.paidBy.name}</span>{' → '}<span className="text-green-600">{s.paidTo.name}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.settlementDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {s.notes ? ` · ${s.notes}` : ''}
                </p>
              </div>
              <p className="font-semibold text-gray-900">
                {s.currency === 'INR' ? '₹' : '$'}{Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
