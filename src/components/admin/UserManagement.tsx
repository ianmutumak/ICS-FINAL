import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useHandover } from '../../context/HandoverContext';
import { api, errorMessage } from '../../lib/api';
import type { UserStaff } from '../../types';

type Status = NonNullable<UserStaff['status']>;

interface FormState {
  name: string;
  staffNumber: string;
  pin: string;
  role: string;
  department: string;
  qualification: string;
  isAdmin: boolean;
  status: Status;
}

const EMPTY_FORM: FormState = { name: '', staffNumber: '', pin: '', role: '', department: '', qualification: '', isAdmin: false, status: 'active' };
const STATUS_LABELS: Record<Status, string> = { active: 'Active', on_leave: 'On leave', suspended: 'Suspended' };
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

/** Administrator screen to create, read, update and delete staff accounts. The server checks every change. */
export const UserManagement: React.FC = () => {
  const { currentUser } = useHandover();
  const [users, setUsers] = useState<UserStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  // null: no dialog; 'new': creating; otherwise the user being edited
  const [editing, setEditing] = useState<UserStaff | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<UserStaff | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    try {
      setUsers(await api<UserStaff[]>('GET', '/users'));
      setLoadError('');
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? users.filter((user) => [user.name, user.staffNumber, user.role, user.department].some((value) => value.toLowerCase().includes(query)))
      : users;
  }, [users, search]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setEditing('new');
  };
  const openEdit = (user: UserStaff) => {
    setForm({
      name: user.name, staffNumber: user.staffNumber, pin: '', role: user.role, department: user.department,
      qualification: user.qualification, isAdmin: Boolean(user.isAdmin), status: user.status ?? 'active',
    });
    setFormError('');
    setEditing(user);
  };
  const close = () => setEditing(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        const created = await api<UserStaff>('POST', '/users', form);
        setUsers((previous) => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        // A blank PIN means "keep the current PIN".
        const { pin, ...rest } = form;
        const updated = await api<UserStaff>('PATCH', `/users/${editing.id}`, pin ? { ...rest, pin } : rest);
        setUsers((previous) => previous.map((user) => (user.id === updated.id ? updated : user)));
      }
      close();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api('DELETE', `/users/${deleting.id}`);
      setUsers((previous) => previous.filter((user) => user.id !== deleting.id));
      setDeleting(null);
      setDeleteError('');
    } catch (error) {
      setDeleteError(errorMessage(error));
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Users</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {users.length} account{users.length === 1 ? '' : 's'}. Create, change or remove staff and administrators.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="relative">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="w-44 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            <UserPlus className="h-4 w-4" /> Add user
          </button>
        </div>
      </div>

      {loadError && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">{loadError}</p>}

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{search ? 'No user matches the search.' : 'No users yet.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                <th scope="col" className="px-5 py-3 font-semibold">Badge ID</th>
                <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                <th scope="col" className="px-5 py-3 font-semibold">Access</th>
                <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                    {user.name}{user.id === currentUser.id && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">You</span>}
                    {user.department && <span className="block text-xs font-normal text-slate-500">{user.department}</span>}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-300">{user.staffNumber}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{user.role || '—'}</td>
                  <td className="px-5 py-3">
                    {user.isAdmin
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-800"><Lock className="h-3 w-3" /> Administrator</span>
                      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">Staff</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.status === 'suspended' ? 'bg-rose-100 text-rose-800' : user.status === 'on_leave' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                      {STATUS_LABELS[user.status ?? 'active']}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button type="button" onClick={() => openEdit(user)} aria-label={`Edit ${user.name}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => { setDeleting(user); setDeleteError(''); }} disabled={user.id === currentUser.id} aria-label={`Delete ${user.name}`} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 id="user-form-title" className="text-base font-bold text-slate-900 dark:text-white">{editing === 'new' ? 'Add a user' : `Edit ${editing.name}`}</h3>
              <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full name *<input required maxLength={80} value={form.name} onChange={(event) => set('name', event.target.value)} className={field} /></label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Badge ID *<input required minLength={4} maxLength={40} value={form.staffNumber} onChange={(event) => set('staffNumber', event.target.value)} className={`${field} font-mono`} /></label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {editing === 'new' ? 'PIN (4 to 6 digits) *' : 'New PIN (leave blank to keep)'}
                <input required={editing === 'new'} type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="new-password" value={form.pin} onChange={(event) => set('pin', event.target.value)} className={`${field} font-mono tracking-widest`} />
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Role<input maxLength={80} value={form.role} onChange={(event) => set('role', event.target.value)} className={field} /></label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Department<input maxLength={80} value={form.department} onChange={(event) => set('department', event.target.value)} className={field} /></label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Certifications<input maxLength={120} value={form.qualification} onChange={(event) => set('qualification', event.target.value)} className={field} /></label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status
                <select value={form.status} onChange={(event) => set('status', event.target.value as Status)} className={field}>
                  {(Object.keys(STATUS_LABELS) as Status[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={form.isAdmin} onChange={(event) => set('isAdmin', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700" />
                Administrator
              </label>
            </div>
            {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                <Plus className="h-4 w-4" /> {editing === 'new' ? 'Create user' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title" className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 id="delete-user-title" className="text-base font-bold text-slate-900 dark:text-white">Delete {deleting.name}?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Their account is removed and they can no longer sign in. Handovers they signed keep their name, because those records are evidence. To stop someone signing in but keep the account, set the status to Suspended instead.
            </p>
            {deleteError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Keep the account</button>
              <button type="button" onClick={confirmDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
