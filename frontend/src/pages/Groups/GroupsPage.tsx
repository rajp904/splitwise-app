// Groups dashboard — list all groups the user belongs to, create new groups.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../../api/groups';
import type { Group } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Users, Plus, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    groupsApi.list()
      .then(setGroups)
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    try {
      const group = await groupsApi.create(newGroupName.trim(), newGroupDesc.trim() || undefined);
      setGroups((prev) => [group, ...prev]);
      setShowCreateForm(false);
      setNewGroupName('');
      setNewGroupDesc('');
      toast.success(`Group "${group.name}" created`);
    } catch {
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Your Groups</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">
          <Plus className="h-4 w-4" /> New Group
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 items-end">
          <Input
            label="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Flat C-42"
            className="min-w-0 flex-1"
          />
          <Input
            label="Description (optional)"
            value={newGroupDesc}
            onChange={(e) => setNewGroupDesc(e.target.value)}
            placeholder="Shared flat expenses"
            className="min-w-0 flex-1"
          />
          <Button type="submit" isLoading={isCreating}>Create</Button>
          <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
        </form>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No groups yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const activeMembers = group.memberships.filter((m) => !m.leftAt);
            return (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-gray-900">{group.name}</p>
                  {group.description && (
                    <p className="mt-0.5 text-xs text-gray-500">{group.description}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''} ·{' '}
                    {group._count?.expenses ?? 0} expense{(group._count?.expenses ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
