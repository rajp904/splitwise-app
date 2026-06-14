// Group detail page — tabs for Expenses, Balances, Settlements, Import.
// Imports are all at the top — TypeScript requires this.

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { groupsApi } from '../../api/groups';
import type { Group } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Receipt, Scale, CreditCard, Upload, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { ExpensesTab }    from '../Expenses/ExpensesTab';
import { BalancesTab }    from '../Balances/BalancesTab';
import { SettlementsTab } from '../Settlements/SettlementsTab';
import { ImportTab }      from '../Import/ImportTab';

type Tab = 'expenses' | 'balances' | 'settlements' | 'import';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('expenses');

  useEffect(() => {
    if (!id) return;
    groupsApi.get(id)
      .then(setGroup)
      .catch(() => toast.error('Failed to load group'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!group) return <div className="py-20 text-center text-red-500">Group not found</div>;

  const activeMembers = group.memberships.filter((m) => !m.leftAt);
  const pastMembers = group.memberships.filter((m) => m.leftAt);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'expenses',    label: 'Expenses',    icon: <Receipt className="h-4 w-4" /> },
    { id: 'balances',    label: 'Balances',    icon: <Scale className="h-4 w-4" /> },
    { id: 'settlements', label: 'Settlements', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'import',      label: 'Import CSV',  icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link to="/" className="hover:text-blue-600">Groups</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{group.name}</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">{group.name}</h1>
        {group.description && <p className="mt-1 text-sm text-gray-500">{group.description}</p>}

        {/* Members */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          {activeMembers.map((m) => (
            <Badge key={m.userId} label={m.user.name} color="blue" />
          ))}
          {pastMembers.map((m) => (
            <Badge key={m.userId} label={`${m.user.name} (left)`} color="gray" />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'expenses'    && <ExpensesTab groupId={group.id} group={group} />}
      {activeTab === 'balances'    && <BalancesTab groupId={group.id} />}
      {activeTab === 'settlements' && <SettlementsTab groupId={group.id} group={group} />}
      {activeTab === 'import'      && <ImportTab groupId={group.id} />}
    </div>
  );
}
