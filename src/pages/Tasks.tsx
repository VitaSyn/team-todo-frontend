import { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import {
  Plus, Edit2, Trash2, CheckCircle2, Loader2, Moon,
  Sparkles, CheckSquare, Clock,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import clsx from 'clsx';

type TaskStatus = 'dormant' | 'in_progress' | 'completed';

// ── Status config & Priority Order ───────────────────────────────────────────
const STATUS_ORDER: Record<TaskStatus, number> = {
  dormant: 1,
  in_progress: 2,
  completed: 3,
};

const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  icon: React.ElementType;
  pill: string;
  nextLabel: string;
}> = {
  dormant: {
    label: 'Dormant',
    icon: Moon,
    pill: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
    nextLabel: 'Start working',
  },
  in_progress: {
    label: 'In Progress',
    icon: Loader2,
    pill: 'bg-[rgba(189,166,247,0.12)] text-[var(--color-lavender-light)] border border-[rgba(189,166,247,0.3)]',
    nextLabel: 'Mark as complete',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    pill: 'bg-[rgba(171,236,218,0.12)] text-[var(--color-mint-light)] border border-[rgba(171,236,218,0.32)]',
    nextLabel: 'Revert to In Progress',
  },
};

const normalizeStatus = (status?: string): TaskStatus => {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'dormant';
};

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const Tasks = () => {
  const { user } = useContext(AuthContext);
  const [members, setMembers] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Admin task create/edit modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [formData, setFormData] = useState({ title: '', description: '' });

  // Completion modal (member flow)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completingTask, setCompletingTask] = useState<any>(null);
  const [finalDescription, setFinalDescription] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Custom modals (replaces native window.confirm & alert)
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
  });

  const showAlert = (title: string, message: string, variant: 'danger' | 'warning' | 'info' | 'success' = 'danger') => {
    setAlertDialog({ isOpen: true, title, message, variant });
  };

  const isAdmin = user?.role === 'admin';

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/members');
      setMembers(res.data);
      if (res.data.length > 0 && !activeTabId) {
        const userMember = res.data.find((m: any) => m._id === user?.id);
        setActiveTabId(userMember ? userMember._id : res.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch members', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // ── Admin modal ──────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setCurrentTask(null);
    setFormData({ title: '', description: '' });
    setIsTaskModalOpen(true);
  };

  const openEditModal = (task: any) => {
    setCurrentTask(task);
    setFormData({ title: task.title, description: task.description || '' });
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTabId) return;
    try {
      if (currentTask) {
        await axios.put(`/api/members/${activeTabId}/tasks/${currentTask._id}`, formData);
      } else {
        await axios.post(`/api/members/${activeTabId}/tasks`, formData);
      }
      setIsTaskModalOpen(false);
      fetchMembers();
    } catch (err) {
      showAlert('Save Failed', 'Failed to save task. Please try again.');
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete || !activeTabId) return;
    setIsDeletingTask(true);
    try {
      await axios.delete(`/api/members/${activeTabId}/tasks/${taskToDelete._id}`);
      setTaskToDelete(null);
      fetchMembers();
    } catch (err) {
      setTaskToDelete(null);
      showAlert('Delete Failed', 'Failed to delete the task. Please try again.');
    } finally {
      setIsDeletingTask(false);
    }
  };

  // ── Status change handler ───────────────────────────────────────────────────
  const handleStatusClick = (task: any) => {
    const status: TaskStatus = normalizeStatus(task.status);

    if (status === 'dormant') {
      // dormant → in_progress (direct, no modal)
      patchStatus(task._id, 'in_progress');
    } else if (status === 'in_progress') {
      // in_progress → completed (open modal for final description)
      setCompletingTask(task);
      setFinalDescription('');
      setIsCompleteModalOpen(true);
    } else {
      // completed → in_progress (revert, direct)
      patchStatus(task._id, 'in_progress');
    }
  };

  const patchStatus = async (
    taskId: string,
    status: TaskStatus,
    finalDesc?: string,
  ) => {
    setSavingStatus(true);
    try {
      await axios.patch(`/api/members/${activeTabId}/tasks/${taskId}/status`, {
        status,
        ...(finalDesc !== undefined && { finalDescription: finalDesc }),
      });
      fetchMembers();
    } catch (err) {
      showAlert('Permission Denied', 'Failed to update task status. Ensure you have permission to edit this task.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    await patchStatus(completingTask._id, 'completed', finalDescription);
    setIsCompleteModalOpen(false);
    setCompletingTask(null);
  };

  const handleMakeDormant = async () => {
    if (!completingTask) return;
    await patchStatus(completingTask._id, 'dormant');
    setIsCompleteModalOpen(false);
    setCompletingTask(null);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const activeMember = members.find(m => m._id === activeTabId);
  const canChangeStatus = user?.id === activeTabId;

  const dormantCount    = activeMember?.tasks?.filter((t: any) => normalizeStatus(t.status) === 'dormant').length    ?? 0;
  const inProgressCount = activeMember?.tasks?.filter((t: any) => normalizeStatus(t.status) === 'in_progress').length ?? 0;
  const completedCount  = activeMember?.tasks?.filter((t: any) => normalizeStatus(t.status) === 'completed').length  ?? 0;
  const totalCount      = activeMember?.tasks?.length ?? 0;
  const progressPct     = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Sort tasks: dormant first, in_progress next, completed last.
  // Within each status group, sort by updatedAt ascendingly (most recently updated first).
  const sortedTasks = useMemo(() => {
    if (!activeMember?.tasks) return [];
    return [...activeMember.tasks].sort((a: any, b: any) => {
      const statusA: TaskStatus = normalizeStatus(a.status);
      const statusB: TaskStatus = normalizeStatus(b.status);

      // 1. Status order: dormant (1) -> in_progress (2) -> completed (3)
      const diffStatus = STATUS_ORDER[statusA] - STATUS_ORDER[statusB];
      if (diffStatus !== 0) return diffStatus;

      // 2. Within each group: recently updated first (newest timestamp)
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [activeMember?.tasks]);

  // ── Loading / empty states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-16 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-3 rounded-full border-t-[var(--color-lavender)] border-r-[var(--color-mint)] border-b-[var(--color-bg-elevated)] border-l-[var(--color-bg-elevated)] animate-spin" />
          <div className="absolute inset-0 rounded-full blur-sm bg-gradient-to-tr from-[var(--color-lavender)] to-[var(--color-mint)] opacity-30 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-muted)] tracking-wider uppercase">Loading Tasks...</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-[var(--color-text-muted)] text-center">
        <CheckSquare className="w-12 h-12 mb-3 opacity-40 text-[var(--color-lavender)]" />
        <p className="text-xl font-bold text-white">No members found</p>
        {isAdmin && <p className="mt-2 text-sm text-[var(--color-text-muted)]">Add team members first from the Members directory.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">

      {/* ── Member Tabs ── */}
      <div className="shrink-0 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] sticky top-0 z-20 shadow-sm backdrop-blur-md">
        <div className="flex overflow-x-auto hide-scrollbar px-4 sm:px-6 py-3 gap-2 max-w-7xl mx-auto">
          {members.map(member => {
            const isSelected = activeTabId === member._id;
            const isMe = user?.id === member._id;
            return (
              <button
                key={member._id}
                onClick={() => setActiveTabId(member._id)}
                className={clsx(
                  'px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 rounded-xl whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer',
                  isSelected
                    ? 'btn-dual text-[#0f1015] shadow-[0_4px_16px_rgba(189,166,247,0.3)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-white border border-[var(--color-border-subtle)]'
                )}
              >
                <span>{member.name.split(' ')[0]}</span>
                {isMe && (
                  <span className={clsx(
                    'text-[10px] font-black uppercase px-1.5 py-0.2 rounded',
                    isSelected ? 'bg-black/20 text-[#0f1015]' : 'bg-[var(--color-mint-muted)] text-[var(--color-mint-dark)]'
                  )}>
                    me
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">

          {/* Header banner */}
          <div className="card p-5 sm:p-7 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-lavender)] via-[var(--color-lavender-light)] to-[var(--color-mint)] opacity-60" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-lavender-muted)] border border-[var(--color-border)] mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-lavender)]" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-lavender-light)]">Task Workspace</span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {activeMember?.name}'s Tasks
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {/* Dormant */}
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                    <Moon className="w-3 h-3" />{dormantCount} Dormant
                  </span>
                  {/* In Progress */}
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[rgba(189,166,247,0.1)] text-[var(--color-lavender-light)] border border-[rgba(189,166,247,0.25)]">
                    <Loader2 className="w-3 h-3" />{inProgressCount} In Progress
                  </span>
                  {/* Completed */}
                  <span className="badge-completed text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] shadow-[0_0_6px_var(--color-mint)]" />
                    {completedCount} Completed
                  </span>
                  <span className="text-xs font-bold text-[var(--color-text-muted)] ml-1">
                    ({progressPct}% finished)
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button onClick={openAddModal} className="btn-dual flex items-center gap-2 self-start sm:self-auto text-xs sm:text-sm">
                  <Plus className="w-4 h-4" />
                  <span>Assign New Task</span>
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-5 pt-4 border-t border-[var(--color-border-subtle)]">
              <div
                className="h-2.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden p-0.5 border border-[var(--color-border-subtle)]"
                title={totalCount > 0 ? `${completedCount} completed, ${inProgressCount} in progress, ${dormantCount} dormant` : 'No tasks assigned'}
              >
                {totalCount > 0 ? (
                  <div className="h-full w-full rounded-full overflow-hidden flex">
                    {completedCount > 0 && (
                      <div
                        style={{
                          width: `${(completedCount / totalCount) * 100}%`,
                          background: 'linear-gradient(90deg, var(--color-mint-dark), var(--color-mint))',
                          boxShadow: '0 0 10px rgba(171,236,218,0.35)',
                        }}
                        className="h-full transition-all duration-500 ease-out shrink-0"
                        title={`Completed: ${completedCount} (${Math.round((completedCount / totalCount) * 100)}%)`}
                      />
                    )}
                    {inProgressCount > 0 && (
                      <div
                        style={{
                          width: `${(inProgressCount / totalCount) * 100}%`,
                          background: 'linear-gradient(90deg, #9374eb, var(--color-lavender))',
                          boxShadow: '0 0 10px rgba(189,166,247,0.35)',
                        }}
                        className="h-full transition-all duration-500 ease-out shrink-0"
                        title={`In Progress: ${inProgressCount} (${Math.round((inProgressCount / totalCount) * 100)}%)`}
                      />
                    )}
                    {dormantCount > 0 && (
                      <div
                        style={{
                          width: `${(dormantCount / totalCount) * 100}%`,
                          background: 'linear-gradient(90deg, #4a5065, #8c93a8)',
                        }}
                        className="h-full transition-all duration-500 ease-out shrink-0"
                        title={`Dormant: ${dormantCount} (${Math.round((dormantCount / totalCount) * 100)}%)`}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-full rounded-full" style={{ width: '0%' }} />
                )}
              </div>
            </div>
          </div>

          {/* ── Task List ── */}
          {totalCount === 0 ? (
            <div className="card flex flex-col items-center justify-center p-12 sm:p-16 text-center border-dashed">
              <CheckSquare className="w-12 h-12 text-[var(--color-text-muted)] mb-3 opacity-40" />
              <p className="text-base font-bold text-white">No tasks assigned yet</p>
              {isAdmin && <p className="text-sm text-[var(--color-text-muted)] mt-1">Click "Assign New Task" above to get started.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task: any) => {
                const status: TaskStatus = normalizeStatus(task.status);
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.dormant;
                const isDone = status === 'completed';
                const StatusIcon = cfg.icon;

                return (
                  <div
                    key={task._id}
                    className={clsx(
                      'group flex items-start justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-250',
                      isDone
                        ? 'bg-[var(--color-bg-card)]/60 border-[rgba(171,236,218,0.2)] shadow-sm'
                        : status === 'in_progress'
                          ? 'bg-[var(--color-bg-card)] border-[rgba(189,166,247,0.22)] shadow-[0_0_20px_-6px_rgba(189,166,247,0.15)]'
                          : 'bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-[var(--color-border-lavender)] hover:shadow-lg'
                    )}
                  >
                    <div className="flex items-start flex-1 gap-3.5 mr-3 min-w-0">

                      {/* Status toggle button (member only) */}
                      {canChangeStatus ? (
                        <button
                          onClick={() => handleStatusClick(task)}
                          disabled={savingStatus}
                          className={clsx(
                            'shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95',
                            isDone
                              ? 'border-[var(--color-mint)] bg-[rgba(171,236,218,0.15)] text-[var(--color-mint-light)]'
                              : status === 'in_progress'
                                ? 'border-[var(--color-lavender)] bg-[rgba(189,166,247,0.1)] text-[var(--color-lavender)]'
                                : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:border-[var(--color-lavender)] hover:text-[var(--color-lavender)]'
                          )}
                          title={cfg.nextLabel}
                        >
                          <StatusIcon className={clsx('w-3.5 h-3.5', status === 'in_progress' && 'animate-spin')} />
                        </button>
                      ) : (
                        /* Non-owner: just show status icon, no interaction */
                        <div className={clsx(
                          'shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center opacity-50',
                          isDone ? 'border-[var(--color-mint)] text-[var(--color-mint-light)]'
                            : status === 'in_progress' ? 'border-[var(--color-lavender)] text-[var(--color-lavender)]'
                              : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                        )}>
                          <StatusIcon className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className={clsx(
                          'text-sm sm:text-base font-bold leading-snug transition-colors',
                          isDone
                            ? 'line-through text-[var(--color-mint-dark)]'
                            : 'text-white group-hover:text-[var(--color-lavender-light)]'
                        )}>
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className={clsx(
                            'mt-1 text-xs sm:text-sm font-medium leading-relaxed',
                            isDone ? 'text-[var(--color-mint-dark)]/70' : 'text-[var(--color-text-secondary)]'
                          )}>
                            {task.description}
                          </p>
                        )}

                        {/* Final description (completed tasks only) */}
                        {isDone && task.finalDescription && (
                          <div className="mt-2.5 p-3 rounded-xl bg-[rgba(171,236,218,0.06)] border border-[rgba(171,236,218,0.15)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-mint-dark)] mb-1">
                              Completion Notes
                            </p>
                            <p className="text-xs text-[var(--color-mint-dark)]/80 leading-relaxed">
                              {task.finalDescription}
                            </p>
                          </div>
                        )}

                        {/* Status badge & updated time */}
                        <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full',
                            cfg.pill
                          )}>
                            <StatusIcon className={clsx('w-3 h-3', status === 'in_progress' && 'animate-spin')} />
                            {cfg.label}
                          </span>

                          {(task.updatedAt || task.createdAt) && (
                            <span className="text-[10px] font-medium text-[var(--color-text-muted)] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[var(--color-text-muted)]/70" />
                              <span>Updated {formatRelativeTime(task.updatedAt || task.createdAt)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Admin edit / delete controls */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0 bg-[var(--color-bg-elevated)] p-1 rounded-xl border border-[var(--color-border-subtle)]">
                        <button
                          onClick={() => openEditModal(task)}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] rounded-lg transition-all cursor-pointer"
                          aria-label="Edit task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTaskToDelete(task)}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                          aria-label="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Admin: Create / Edit Task Modal ── */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title={currentTask ? 'Edit Task' : 'Assign New Task'}
      >
        <form onSubmit={handleTaskSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Task Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input-field text-sm mt-1"
              placeholder="e.g. Implement Responsive Navigation"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Description <span className="font-normal text-[var(--color-text-muted)] lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field text-sm mt-1 resize-none"
              placeholder="Provide context or acceptance criteria for this task..."
            />
          </div>
          <div className="pt-2">
            <button type="submit" className="btn-dual w-full text-sm">
              {currentTask ? 'Save Changes' : 'Assign Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Member: Mark as Complete Modal ── */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => { setIsCompleteModalOpen(false); setCompletingTask(null); }}
        title="Mark as Completed"
        maxWidth="xl"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          {/* Task summary */}
          {completingTask && (
            <div className="p-3.5 rounded-xl bg-[rgba(189,166,247,0.08)] border border-[rgba(189,166,247,0.2)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-lavender)] mb-1">Completing task</p>
              <p className="text-sm font-bold text-white">{completingTask.title}</p>
              {completingTask.description && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{completingTask.description}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Completion Notes <span className="font-normal text-[var(--color-text-muted)] lowercase">(optional)</span>
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-2">
              Describe what you did, any outcomes, blockers resolved, or comments on the finished work.
            </p>
            <textarea
              rows={4}
              value={finalDescription}
              onChange={(e) => setFinalDescription(e.target.value)}
              className="input-field text-sm resize-none"
              placeholder="e.g. Implemented the feature, tested on mobile and desktop, merged to main branch..."
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={() => { setIsCompleteModalOpen(false); setCompletingTask(null); }}
              className="btn-secondary text-sm py-2.5 px-4 whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMakeDormant}
              disabled={savingStatus}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Moon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              <span className="whitespace-nowrap">Make Dormant</span>
            </button>
            <button
              type="submit"
              disabled={savingStatus}
              className="btn-mint px-5 py-2.5 text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {savingStatus
                ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                : <CheckCircle2 className="w-4 h-4 shrink-0" />
              }
              <span className="whitespace-nowrap">{savingStatus ? 'Saving...' : 'Mark Complete'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Custom Confirmation Modal: Delete Task ── */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title}"? This task will be permanently removed.`}
        confirmText="Delete Task"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingTask}
      />

      {/* ── Custom Alert / Error Modal ── */}
      <ConfirmModal
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
        confirmText="Okay"
      />

    </div>
  );
};
