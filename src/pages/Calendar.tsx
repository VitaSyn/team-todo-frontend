import { useState, useEffect, useMemo, type FormEvent } from 'react';
import axios from 'axios';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Video, Link as LinkIcon, FileText, Plus, Trash2, ExternalLink,
  Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';

export interface Meeting {
  _id: string;
  title: string;
  date: string; // YYYY-MM-DD
  meetingLink: string;
  startTime: string; // "10:00 AM"
  endTime: string;   // "11:00 AM"
  summaryNotes?: string;
  createdBy?: string;
  creatorName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type MeetingStatus = 'upcoming' | 'live' | 'ended_with_notes' | 'ended_no_notes';

/**
 * Parses "YYYY-MM-DD" and "hh:mm AM/PM" (or 24h) into a standard Date object.
 */
export function parseMeetingDateTime(dateStr: string, timeStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1;
  const day = parts[2];

  if (!timeStr) return new Date(year, month, day);

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) {
    return new Date(year, month, day);
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[4]?.toUpperCase();

  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

/**
 * Calculates meeting status according to the exact rules:
 * - Live now (start <= now <= end): GREEN
 * - Not yet completed (upcoming: now < start): YELLOW with text "meet"
 * - Ended with notes (now > end and has notes): BLUE
 * - Ended without notes (now > end and no notes): RED
 */
export function getMeetingStatus(
  meeting: { date: string; startTime: string; endTime: string; summaryNotes?: string },
  now: Date = new Date()
): MeetingStatus {
  const start = parseMeetingDateTime(meeting.date, meeting.startTime);
  let end = parseMeetingDateTime(meeting.date, meeting.endTime);

  // If end is on or before start (e.g. overnight meeting 11 PM - 1 AM), roll end to next day
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end.getTime();

  if (nowMs >= startMs && nowMs <= endMs) {
    return 'live';
  }
  if (nowMs < startMs) {
    return 'upcoming';
  }

  const hasNotes = Boolean(meeting.summaryNotes && meeting.summaryNotes.trim().length > 0);
  if (hasNotes) {
    return 'ended_with_notes';
  } else {
    return 'ended_no_notes';
  }
}

// ── Time Picker Component with 12-Hour AM / PM Selection ───────────────────────
interface TimePickerInputProps {
  label: string;
  value: string; // e.g. "10:00 AM"
  onChange: (val: string) => void;
  required?: boolean;
}

const parseTimeParts = (val: string) => {
  if (!val) return { hour: '10', minute: '00', period: 'AM' };
  const match = val.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { hour: '10', minute: '00', period: 'AM' };
  let h = parseInt(match[1], 10);
  let p = (match[3] || 'AM').toUpperCase();
  if (!match[3]) {
    // If 24h was provided
    if (h >= 12) {
      p = 'PM';
      if (h > 12) h -= 12;
    } else {
      p = 'AM';
      if (h === 0) h = 12;
    }
  }
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return { hour: hStr, minute: match[2], period: p };
};

const TimePickerInput = ({ label, value, onChange }: TimePickerInputProps) => {
  const { hour, minute, period } = parseTimeParts(value);

  const update = (h: string, m: string, p: string) => {
    onChange(`${h}:${m} ${p}`);
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return n < 10 ? `0${n}` : `${n}`;
  });

  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {label}
        </label>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-bg-base)] text-[var(--color-lavender)] border border-[var(--color-border-lavender)]">
          {value || `${hour}:${minute} ${period}`}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-1.5 p-2 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)]">
        {/* Hour Select */}
        <div className="col-span-5 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 hidden sm:block" />
          <select
            value={hour}
            onChange={(e) => update(e.target.value, minute, period)}
            className="w-full bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-sm font-semibold rounded-lg px-2 py-1.5 border border-white/10 focus:border-[var(--color-lavender)] focus:outline-none cursor-pointer"
          >
            {hoursList.map((h) => (
              <option key={h} value={h} className="bg-[#1c1e2b] text-white">
                {h}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1 flex items-center justify-center text-sm font-bold text-[var(--color-text-muted)]">
          :
        </div>

        {/* Minute Select */}
        <div className="col-span-3">
          <select
            value={minute}
            onChange={(e) => update(hour, e.target.value, period)}
            className="w-full bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-sm font-semibold rounded-lg px-2 py-1.5 border border-white/10 focus:border-[var(--color-lavender)] focus:outline-none cursor-pointer"
          >
            {minutesList.map((m) => (
              <option key={m} value={m} className="bg-[#1c1e2b] text-white">
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* AM / PM Segmented Toggle */}
        <div className="col-span-3 flex rounded-lg p-0.5 bg-[var(--color-bg-elevated)] border border-white/10">
          <button
            type="button"
            onClick={() => update(hour, minute, 'AM')}
            className={`flex-1 text-xs font-black rounded-md py-1 transition-all cursor-pointer ${period === 'AM'
              ? 'bg-[var(--color-lavender)] text-[#0f1015] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => update(hour, minute, 'PM')}
            className={`flex-1 text-xs font-black rounded-md py-1 transition-all cursor-pointer ${period === 'PM'
              ? 'bg-[var(--color-mint)] text-[#0f1015] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Calendar Page Component ──────────────────────────────────────────────
export const Calendar = () => {
  // Calendar view navigation state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  // Meeting records state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [activeMeetingIndex, setActiveMeetingIndex] = useState(0);

  // Form inputs state
  const [formData, setFormData] = useState({
    title: 'Team Meeting',
    meetingLink: '',
    startTime: '10:00 AM',
    endTime: '11:00 AM',
    summaryNotes: '',
  });

  const [saving, setSaving] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Alert dialog
  const [alertState, setAlertState] = useState<{
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
    setAlertState({ isOpen: true, title, message, variant });
  };

  // Real-time ticking (every 10 seconds) to ensure status changes live (e.g. upcoming -> live -> ended)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Fetch meetings from backend
  const fetchMeetings = async () => {
    try {
      const res = await axios.get('/api/meetings');
      setMeetings(res.data);
    } catch (err) {
      console.error('Failed to fetch meetings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // ── Month Navigation Helpers ────────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed (0 = Jan)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    const t = new Date();
    setCurrentDate(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  // ── Build Days Grid ─────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to fill complete grid of 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [year, month, now]);

  // Group meetings by date string
  const meetingsByDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    meetings.forEach((m) => {
      if (!map[m.date]) {
        map[m.date] = [];
      }
      map[m.date].push(m);
    });
    return map;
  }, [meetings]);

  // Meetings on currently selected date in modal
  const selectedDateMeetings = useMemo(() => {
    return meetingsByDate[selectedDateStr] || [];
  }, [meetingsByDate, selectedDateStr]);

  const currentMeeting = selectedDateMeetings[activeMeetingIndex] || null;

  // ── Open Modal for a Specific Date Cell ──────────────────────────────────────
  const handleCellClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const dateMts = meetingsByDate[dateStr] || [];

    if (dateMts.length > 0) {
      setActiveMeetingIndex(0);
      const m = dateMts[0];
      setFormData({
        title: m.title || 'Team Meeting',
        meetingLink: m.meetingLink || '',
        startTime: m.startTime || '10:00 AM',
        endTime: m.endTime || '11:00 AM',
        summaryNotes: m.summaryNotes || '',
      });
    } else {
      setActiveMeetingIndex(0);
      // Sensible defaults for starting/ending time
      setFormData({
        title: 'Team Meeting',
        meetingLink: '',
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        summaryNotes: '',
      });
    }
    setIsModalOpen(true);
  };

  // Switch between multiple meetings on the same day in modal
  const selectMeetingTab = (index: number) => {
    setActiveMeetingIndex(index);
    const m = selectedDateMeetings[index];
    if (m) {
      setFormData({
        title: m.title || 'Team Meeting',
        meetingLink: m.meetingLink || '',
        startTime: m.startTime || '10:00 AM',
        endTime: m.endTime || '11:00 AM',
        summaryNotes: m.summaryNotes || '',
      });
    }
  };

  const handleAddNewMeetingOnDate = () => {
    setActiveMeetingIndex(selectedDateMeetings.length);
    setFormData({
      title: 'Team Meeting',
      meetingLink: '',
      startTime: '02:00 PM',
      endTime: '03:00 PM',
      summaryNotes: '',
    });
  };

  // ── Save or Update Meeting ──────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.meetingLink.trim()) {
      showAlert('Missing Link', 'Please provide a valid meeting link.', 'warning');
      return;
    }
    if (!formData.startTime.trim()) {
      showAlert('Missing Start Time', 'Please provide a starting time with AM/PM.', 'warning');
      return;
    }
    if (!formData.endTime.trim()) {
      showAlert('Missing End Time', 'Please provide an ending time with AM/PM.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (currentMeeting && currentMeeting._id) {
        // Update existing meeting
        const res = await axios.put(`/api/meetings/${currentMeeting._id}`, {
          title: formData.title,
          date: selectedDateStr,
          meetingLink: formData.meetingLink,
          startTime: formData.startTime,
          endTime: formData.endTime,
          summaryNotes: formData.summaryNotes,
        });

        setMeetings((prev) =>
          prev.map((m) => (m._id === currentMeeting._id ? res.data : m))
        );
      } else {
        // Create new meeting
        const res = await axios.post('/api/meetings', {
          title: formData.title,
          date: selectedDateStr,
          meetingLink: formData.meetingLink,
          startTime: formData.startTime,
          endTime: formData.endTime,
          summaryNotes: formData.summaryNotes,
        });

        setMeetings((prev) => [...prev, res.data]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save failed', err);
      showAlert('Save Failed', err.response?.data?.message || 'Could not save meeting. Please try again.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Meeting ──────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!meetingToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/meetings/${meetingToDelete._id}`);
      setMeetings((prev) => prev.filter((m) => m._id !== meetingToDelete._id));
      setMeetingToDelete(null);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Delete failed', err);
      showAlert('Delete Failed', 'Failed to delete meeting.', 'danger');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Month Statistics for Header ─────────────────────────────────────────────
  const stats = useMemo(() => {
    let upcoming = 0;
    let live = 0;
    let endedWithNotes = 0;
    let endedNoNotes = 0;

    meetings.forEach((m) => {
      const status = getMeetingStatus(m, now);
      if (status === 'live') live++;
      else if (status === 'upcoming') upcoming++;
      else if (status === 'ended_with_notes') endedWithNotes++;
      else if (status === 'ended_no_notes') endedNoNotes++;
    });

    return { total: meetings.length, upcoming, live, endedWithNotes, endedNoNotes };
  }, [meetings, now]);

  // Formatted active date label for modal header
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDateStr) return '';
    const parts = selectedDateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDateStr]);

  const currentMeetingStatus = currentMeeting ? getMeetingStatus(currentMeeting, now) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-16 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-3 rounded-full border-t-[var(--color-lavender)] border-r-[var(--color-mint)] border-b-[var(--color-bg-elevated)] border-l-[var(--color-bg-elevated)] animate-spin" />
          <div className="absolute inset-0 rounded-full blur-sm bg-gradient-to-tr from-[var(--color-lavender)] to-[var(--color-mint)] opacity-30 animate-pulse" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Loading Calendar...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* ── Top Header & Stats ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[var(--color-lavender-muted)] border border-[var(--color-border-lavender)] text-[var(--color-lavender)]">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Team Calendar
            </h1>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Schedule meetings, join live sessions, and track summary notes in one place.
          </p>
        </div>

        {/* Live Clock / Today badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={jumpToToday}
            className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-mint)]" />
            <span>Today</span>
          </button>

          <div className="px-3.5 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-mono font-bold text-[var(--color-mint-light)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-mint)] animate-pulse" />
            <span>{now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* ── Color Status Legend Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 ">


        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Yellow - Meet */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-300">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="font-extrabold uppercase text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-mono">
              <span>{stats.upcoming}</span> {" "}meet
            </span>
            <span className="text-[var(--color-text-secondary)]">Upcoming / Scheduled</span>
          </div>

          {/* Green - Live */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-extrabold uppercase text-[10px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-mono">
              <span>{stats.live}</span> {" "}LIVE
            </span>
            <span className="text-[var(--color-text-secondary)]">Meeting Now</span>
          </div>

          {/* Blue - Ended with Notes */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-400/10 border border-sky-400/30 text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span className="font-extrabold uppercase text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono border border-sky-400/30">
              <span>{stats.endedWithNotes}</span> {" "}Notes
            </span>
            <span className="text-[var(--color-text-secondary)]">Ended (Notes Added)</span>
          </div>

          {/* Red - Ended without Notes */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-400/10 border border-rose-400/30 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-extrabold uppercase text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono border border-rose-400/30">
              <span>{stats.endedNoNotes}</span> {" "}No Notes
            </span>
            <span className="text-[var(--color-text-secondary)]">Ended (Needs Notes)</span>
          </div>
        </div>
      </div>


      {/* ── Main Calendar Card ────────────────────────────────────────────── */}
      <div className="card bg-[var(--color-bg-surface)] border border-[var(--color-border)] overflow-hidden shadow-2xl">
        {/* Calendar Navigation Bar */}
        <div className="p-4 sm:p-6 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{monthNames[month]}</span>
              <span className="text-[var(--color-lavender)]">{year}</span>
            </h2>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-lavender)] transition-all cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={nextMonth}
              className="p-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-lavender)] transition-all cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/60 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => (
            <div
              key={dayName}
              className={`py-3 text-[11px] font-black uppercase tracking-wider ${idx === 0 || idx === 6 ? 'text-[var(--color-lavender)]' : 'text-[var(--color-text-muted)]'
                }`}
            >
              <span>{dayName}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[var(--color-border)] bg-[var(--color-bg-surface)]">
          {calendarDays.map((cell) => {
            const cellMeetings = meetingsByDate[cell.dateStr] || [];
            const hasMeeting = cellMeetings.length > 0;

            // Determine primary cell meeting status
            let primaryStatus: MeetingStatus | null = null;
            if (hasMeeting) {
              const statuses = cellMeetings.map((m) => getMeetingStatus(m, now));
              if (statuses.includes('live')) primaryStatus = 'live';
              else if (statuses.includes('ended_no_notes')) primaryStatus = 'ended_no_notes';
              else if (statuses.includes('upcoming')) primaryStatus = 'upcoming';
              else primaryStatus = 'ended_with_notes';
            }

            // Cell styling based on status
            let cellStyle = 'hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer';
            if (primaryStatus === 'live') {
              cellStyle = 'bg-emerald-500/10 border-emerald-500/50 hover:bg-emerald-500/15 ring-1 ring-emerald-500/30';
            } else if (primaryStatus === 'upcoming') {
              cellStyle = 'bg-yellow-400/10 border-yellow-400/50 hover:bg-yellow-400/15 ring-1 ring-yellow-400/30';
            } else if (primaryStatus === 'ended_with_notes') {
              cellStyle = 'bg-sky-500/10 border-sky-500/50 hover:bg-sky-500/15 ring-1 ring-sky-500/30';
            } else if (primaryStatus === 'ended_no_notes') {
              cellStyle = 'bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/15 ring-1 ring-rose-500/30';
            } else if (!cell.isCurrentMonth) {
              cellStyle = 'opacity-40 hover:opacity-80 hover:bg-[var(--color-bg-hover)]';
            }

            return (
              <div
                key={cell.dateStr}
                onClick={() => handleCellClick(cell.dateStr)}
                className={`relative min-h-[92px] sm:min-h-[110px] p-2 flex flex-col justify-between group ${cellStyle}`}
              >
                {/* Cell Header: Day Number & Today Marker */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs sm:text-sm font-extrabold w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${cell.isToday
                      ? 'bg-[var(--color-lavender)] text-[#0f1015] font-black shadow-[0_0_10px_rgba(189,166,247,0.5)]'
                      : cell.isCurrentMonth
                        ? 'text-white group-hover:text-[var(--color-lavender-light)]'
                        : 'text-[var(--color-text-muted)]'
                      }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {cell.isToday && (
                    <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-mint-muted)] text-[var(--color-mint-dark)] border border-[rgba(171,236,218,0.3)]">
                      Today
                    </span>
                  )}
                </div>

                {/* Meeting Badges within Cell */}
                <div className="mt-1.5 space-y-1 flex-1 overflow-hidden">
                  {cellMeetings.slice(0, 2).map((m) => {
                    const status = getMeetingStatus(m, now);

                    if (status === 'live') {
                      return (
                        <div
                          key={m._id}
                          className="flex items-center justify-between px-1.5 py-1 rounded bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)] text-[10px] font-black leading-tight animate-pulse"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                            <span>LIVE</span>
                          </span>
                          <span className="text-[9px] opacity-90 shrink-0 ml-1">{m.startTime}</span>
                        </div>
                      );
                    }

                    if (status === 'upcoming') {
                      return (
                        <div
                          key={m._id}
                          className="flex items-center justify-between px-1.5 py-1 rounded bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.4)] text-[10px] font-black leading-tight"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>meet</span>
                          </span>
                          <span className="text-[9px] opacity-90 shrink-0 ml-1">{m.startTime}</span>
                        </div>
                      );
                    }

                    if (status === 'ended_with_notes') {
                      return (
                        <div
                          key={m._id}
                          className="flex items-center justify-between px-1.5 py-1 rounded bg-sky-500/20 text-sky-200 border border-sky-400/40 text-[10px] font-bold leading-tight"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <FileText className="w-2.5 h-2.5 shrink-0 text-sky-300" />
                            <span className="truncate">Notes</span>
                          </span>
                          <span className="text-[9px] opacity-75 shrink-0 ml-1">{m.startTime}</span>
                        </div>
                      );
                    }

                    // ended_no_notes (Red)
                    return (
                      <div
                        key={m._id}
                        className="flex items-center justify-between px-1.5 py-1 rounded bg-rose-500/25 text-rose-200 border border-rose-500/50 text-[10px] font-bold leading-tight"
                      >
                        <span className="flex items-center gap-1 truncate">
                          <AlertCircle className="w-2.5 h-2.5 shrink-0 text-rose-300" />
                          <span className="truncate">No Notes</span>
                        </span>
                        <span className="text-[9px] opacity-75 shrink-0 ml-1">{m.startTime}</span>
                      </div>
                    );
                  })}

                  {cellMeetings.length > 2 && (
                    <p className="text-[9px] font-bold text-[var(--color-text-muted)] pl-1">
                      +{cellMeetings.length - 2} more
                    </p>
                  )}
                </div>

                {/* Hover affordance when empty */}
                {!hasMeeting && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end text-[10px] text-[var(--color-lavender)] font-bold">
                    <span className="flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Add
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>



      {/* ── Meeting Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          selectedDateMeetings.length > 0 && currentMeeting
            ? `Meeting — ${formattedSelectedDate}`
            : `Schedule Meeting — ${formattedSelectedDate}`
        }
        maxWidth="lg"
      >
        <div className="space-y-5">
          {/* Multiple meetings tabs if date has more than 1 meeting */}
          {selectedDateMeetings.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[var(--color-border)] hide-scrollbar">
              {selectedDateMeetings.map((m, idx) => {
                const status = getMeetingStatus(m, now);
                let badgeCls = 'border-yellow-400/40 text-yellow-300 bg-yellow-400/10';
                if (status === 'live') badgeCls = 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10 animate-pulse';
                else if (status === 'ended_with_notes') badgeCls = 'border-sky-400/40 text-sky-300 bg-sky-400/10';
                else if (status === 'ended_no_notes') badgeCls = 'border-rose-400/40 text-rose-300 bg-rose-400/10';

                return (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => selectMeetingTab(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border cursor-pointer ${activeMeetingIndex === idx
                      ? 'bg-[var(--color-bg-card)] border-[var(--color-lavender)] text-white shadow-[0_0_12px_rgba(189,166,247,0.25)]'
                      : `${badgeCls} hover:bg-white/5`
                      }`}
                  >
                    Meeting #{idx + 1} ({m.startTime})
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddNewMeetingOnDate}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[var(--color-mint)] border border-[var(--color-border-mint)] hover:bg-[var(--color-mint-muted)] transition-all shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          )}

          {/* Status Alert Banner if viewing existing meeting */}
          {currentMeeting && currentMeetingStatus && (
            <div>
              {currentMeetingStatus === 'live' && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between gap-3 text-emerald-300">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Meeting Is Live Now!</p>
                      <p className="text-xs text-emerald-200/90">
                        Active from {currentMeeting.startTime} to {currentMeeting.endTime}
                      </p>
                    </div>
                  </div>
                  {formData.meetingLink && (
                    <a
                      href={
                        formData.meetingLink.startsWith('http')
                          ? formData.meetingLink
                          : `https://${formData.meetingLink}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-mint text-xs py-1.5 px-3 shrink-0 flex items-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Now</span>
                    </a>
                  )}
                </div>
              )}

              {currentMeetingStatus === 'upcoming' && (
                <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/35 flex items-center justify-between text-yellow-300">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-black text-[10px] bg-yellow-400 text-black">
                      meet
                    </span>
                    <span className="text-xs font-semibold">
                      Scheduled upcoming meeting &bull; Starts at {currentMeeting.startTime}
                    </span>
                  </div>
                  {formData.meetingLink && (
                    <a
                      href={
                        formData.meetingLink.startsWith('http')
                          ? formData.meetingLink
                          : `https://${formData.meetingLink}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-yellow-300 hover:text-white flex items-center gap-1 underline underline-offset-2"
                    >
                      <span>Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {currentMeetingStatus === 'ended_with_notes' && (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2 text-sky-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Meeting ended &bull; Summary notes are recorded below.
                  </span>
                </div>
              )}

              {currentMeetingStatus === 'ended_no_notes' && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-extrabold uppercase tracking-wide">Meeting Ended &bull; Notes Missing (Red Status)</p>
                    <p className="text-rose-200/80 mt-0.5">
                      Add summary notes in the text area below and click Save to mark this meeting complete (turns Blue).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Optional Topic / Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
                Meeting Title / Topic
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Daily Standup, Sprint Review, Client Sync"
                className="input-field text-sm"
              />
            </div>

            {/* Meeting Link Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Meeting Link <span className="text-[var(--color-lavender)]">*</span>
                </label>
                {formData.meetingLink && (
                  <a
                    href={
                      formData.meetingLink.startsWith('http')
                        ? formData.meetingLink
                        : `https://${formData.meetingLink}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[var(--color-mint)] hover:underline flex items-center gap-1"
                  >
                    <span>Test Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.meetingLink}
                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                  placeholder="https://meet.google.com/xyz-abcd-efg or Zoom link"
                  className="input-field pl-9 text-sm"
                />
              </div>
            </div>

            {/* Starting & Ending Time (Inputs with AM/PM) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TimePickerInput
                label="Starting Time (with AM/PM)"
                value={formData.startTime}
                onChange={(startTime) => setFormData((prev) => ({ ...prev, startTime }))}
                required
              />

              <TimePickerInput
                label="Ending Time (with AM/PM)"
                value={formData.endTime}
                onChange={(endTime) => setFormData((prev) => ({ ...prev, endTime }))}
                required
              />
            </div>

            {/* Summary Notes (Optional TextArea) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Summary Notes <span className="text-[var(--color-text-muted)] font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Adding notes to ended meetings turns them Blue
                </span>
              </div>
              <textarea
                rows={4}
                value={formData.summaryNotes}
                onChange={(e) => setFormData({ ...formData, summaryNotes: e.target.value })}
                placeholder="Enter meeting notes, action items, discussion points, or key takeaways..."
                className="input-field text-sm resize-y leading-relaxed"
              />
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-[var(--color-border)]">
              {currentMeeting && currentMeeting._id ? (
                <button
                  type="button"
                  onClick={() => setMeetingToDelete(currentMeeting)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-dual text-xs py-2 px-5 cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : currentMeeting && currentMeeting._id
                      ? 'Update Meeting'
                      : 'Schedule Meeting'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(meetingToDelete)}
        onClose={() => setMeetingToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Meeting?"
        message={`Are you sure you want to remove the meeting scheduled for ${formattedSelectedDate} (${meetingToDelete?.startTime} - ${meetingToDelete?.endTime})? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* ── Generic Alert Modal ───────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        confirmText="Okay"
      />
    </div>
  );
};
