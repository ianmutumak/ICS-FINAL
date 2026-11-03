import React, { useState } from 'react';
import { useHandover } from '../../context/HandoverContext';
import { ShiftActionItem } from '../../types';
import {
  CheckSquare,
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Trash2,
  ArrowRight,
  Filter,
} from 'lucide-react';

export const TaskManagerView: React.FC = () => {
  const { tasks, addTask, toggleTaskStatus, deleteTask, departments } = useHandover();

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'normal'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'carried_over'>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDeptId, setNewDeptId] = useState(departments[0]?.id || 'dept-imp');
  const [newPriority, setNewPriority] = useState<'urgent' | 'high' | 'normal'>('normal');
  const [newAssignee, setNewAssignee] = useState('Incoming Shift Lead');
  const [newDueTime, setNewDueTime] = useState('09:00 AM');

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (selectedDeptFilter !== 'all' && t.departmentId !== selectedDeptFilter) return false;
    if (selectedPriorityFilter !== 'all' && t.priority !== selectedPriorityFilter) return false;
    if (selectedStatusFilter !== 'all') {
      if (selectedStatusFilter === 'carried_over') {
        if (!t.carriedOverFromPrevious) return false;
      } else if (t.status !== selectedStatusFilter) {
        return false;
      }
    }
    return true;
  });

  const totalCount = tasks.length;
  const urgentCount = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length;
  const carriedOverCount = tasks.filter((t) => t.carriedOverFromPrevious).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const targetDept = departments.find((d) => d.id === newDeptId);
    addTask({
      title: newTitle.trim(),
      priority: newPriority,
      departmentId: newDeptId,
      departmentName: targetDept?.name || 'Primary Operations Bay',
      assignedTo: newAssignee.trim(),
      dueTime: newDueTime.trim(),
    });

    setNewTitle('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                Task Continuity Hub
              </span>
              <span aria-hidden="true">·</span>
              <span>Automated Cross-Shift Roll-Over</span>
              <span aria-hidden="true">·</span>
              <span>Zero-Loss Operational Orders</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Active Shift Tasks & Action Ledger
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Action Task</span>
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-mono">
              TOTAL ACTIVE TASKS
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {totalCount}
            </span>
          </div>
          <div>
            <span className="text-rose-600 dark:text-rose-400 block text-[10px] font-mono">
              URGENT / STAT ORDERS
            </span>
            <span className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {urgentCount}
            </span>
          </div>
          <div>
            <span className="text-amber-600 dark:text-amber-400 block text-[10px] font-mono">
              ROLLED-OVER TASKS
            </span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {carriedOverCount}
            </span>
          </div>
          <div>
            <span className="text-teal-700 dark:text-teal-400 block text-[10px] font-mono">
              SHIFT RESOLUTION RATE
            </span>
            <span className="text-lg font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
              {completionRate}%
            </span>
          </div>
        </div>
      </section>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
          >
            <option value="all">All Operational Zones / Bays</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium capitalize"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        {/* Status Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'completed', label: 'Completed' },
              { id: 'carried_over', label: 'Rolled Over' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`py-1 px-2.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedStatusFilter === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
            <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              No tasks match current filter
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Try adjusting your department or priority filters, or add a new action item.
            </p>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isCompleted = t.status === 'completed';
            return (
              <div
                key={t.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCompleted
                    ? 'border-slate-200 dark:border-slate-800 opacity-60'
                    : t.priority === 'urgent'
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTaskStatus(t.id)}
                    className="pt-0.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {t.title}
                      </span>
                      {t.priority === 'urgent' && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider font-mono">
                          · STAT / URGENT
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{t.departmentName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Due {t.dueTime}</span>
                      <span aria-hidden="true">·</span>
                      <span>Assignee: {t.assignedTo}</span>
                      {t.carriedOverFromPrevious && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono text-[11px]">
                            Rolled Forward
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      t.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : t.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>

                  <button
                    onClick={() => deleteTask(t.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Log New Cross-Shift Action Item
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title / Clinical Order *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Check morning serum Potassium and Magnesium at 08:00 AM"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={newDeptId}
                  onChange={(e) => setNewDeptId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent / STAT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Time
                  </label>
                  <input
                    type="text"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    placeholder="08:30 AM"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Practitioner / Role
                </label>
                <input
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="e.g. Nurse David Kiprop"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 rounded-lg cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
