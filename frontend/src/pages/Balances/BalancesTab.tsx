// Balances tab.
// Shows: (1) per-member net balance, (2) simplified debt graph (Aisha's requirement).

import { useEffect, useState } from 'react';
import { balancesApi } from '../../api/balances';
import type { GroupBalances } from '../../types';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props { groupId: string; }

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(amount);
}

export function BalancesTab({ groupId }: Props) {
  const [data, setData] = useState<GroupBalances | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    balancesApi.getGroupBalances(groupId)
      .then(setData)
      .catch(() => toast.error('Failed to load balances'))
      .finally(() => setIsLoading(false));
  }, [groupId]);

  if (isLoading) return <div className="py-10 text-center text-gray-400">Calculating balances...</div>;
  if (!data) return null;

  const settled = data.memberBalances.every((b) => Math.abs(b.netBalance) < 0.01);

  return (
    <div className="space-y-6">
      {settled && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium text-center">
          All settled up! 🎉
        </div>
      )}

      {/* Simplified debts — Aisha: "one number per person" */}
      {data.simplifiedDebts.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-gray-900">Who pays whom</h2>
          <div className="space-y-2">
            {data.simplifiedDebts.map((debt, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <span className="font-medium text-red-600 w-24 truncate">{debt.fromUserName}</span>
                <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="font-medium text-green-600 w-24 truncate">{debt.toUserName}</span>
                <span className="ml-auto font-semibold text-gray-900">{formatINR(debt.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-member breakdown */}
      <section>
        <h2 className="mb-3 font-semibold text-gray-900">Member balances</h2>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">Member</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Total Paid</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Total Owed</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-500">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.memberBalances.map((mb, i) => (
                <tr key={mb.userId} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{mb.userName}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{formatINR(mb.totalPaid)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{formatINR(mb.totalOwed)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold
                    ${mb.netBalance > 0.01 ? 'text-green-600' : mb.netBalance < -0.01 ? 'text-red-600' : 'text-gray-400'}`}>
                    {mb.netBalance > 0.01 ? '+' : ''}{formatINR(mb.netBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Positive = others owe this person. Negative = this person owes others. All amounts in INR.
        </p>
      </section>
    </div>
  );
}
