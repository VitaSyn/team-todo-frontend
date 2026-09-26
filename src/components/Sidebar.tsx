import { useState, useContext, createContext, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, Calendar as CalendarIcon, LogOut, MessageCircle, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

// ── Sidebar open/close context ───────────────────────────────────────────────
interface SidebarCtx { open: boolean; setOpen: (v: boolean) => void; }
const SidebarContext = createContext<SidebarCtx>({ open: false, setOpen: () => {} });
export const useSidebar = () => useContext(SidebarContext);

// ── Provider wraps the whole app so Layout can also toggle it ────────────────
export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

// ── Inner nav content (shared between desktop & mobile drawer) ───────────────
const SidebarContent = ({ onNav }: { onNav?: () => void }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'group relative flex items-center px-4 py-3 text-sm font-semibold transition-all duration-250 rounded-xl',
      isActive
        ? 'bg-gradient-to-r from-[rgba(189,166,247,0.18)] to-[rgba(171,236,218,0.08)] text-[var(--color-lavender-light)] shadow-[inset_0_0_0_1px_rgba(189,166,247,0.3)]'
        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:translate-x-1',
    ].join(' ');

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-surface)]">
      {/* Logo & Brand */}
      <div className="flex flex-col items-start justify-center px-6 py-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="VitaSyn Logo"
            className="w-10 h-10 object-contain rounded-xl p-0.5 bg-white/5 border border-[var(--color-border-lavender)] shadow-[0_0_16px_rgba(189,166,247,0.25)] shrink-0"
          />
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none flex items-center">
              <span className="text-white">Vita</span>
              <span className="text-[var(--color-lavender)]">Syn</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] ml-1 shadow-[0_0_6px_var(--color-mint)]" />
            </h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              VitaSyn Pvt Ltd
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <p className="px-4 mb-3 text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center justify-between">
          <span>Navigation</span>
          <span className="w-2 h-0.5 rounded bg-[var(--color-lavender)] opacity-60" />
        </p>

        <NavLink to="/dashboard" className={navLinkClass} onClick={onNav}>
          {({ isActive }) => (
            <>
              <LayoutDashboard
                className={`w-5 h-5 mr-3 shrink-0 transition-colors ${isActive ? "text-[var(--color-lavender)]" : "group-hover:text-[var(--color-lavender-light)]"}`}
              />
              <span>Dashboard</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-4 rounded-full bg-[var(--color-lavender)] shadow-[0_0_8px_var(--color-lavender)]" />
              )}
            </>
          )}
        </NavLink>

        <NavLink to="/members" className={navLinkClass} onClick={onNav}>
          {({ isActive }) => (
            <>
              <Users
                className={`w-5 h-5 mr-3 shrink-0 transition-colors ${isActive ? "text-[var(--color-lavender)]" : "group-hover:text-[var(--color-lavender-light)]"}`}
              />
              <span>Members</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-4 rounded-full bg-[var(--color-lavender)] shadow-[0_0_8px_var(--color-lavender)]" />
              )}
            </>
          )}
        </NavLink>

        <NavLink to="/tasks" className={navLinkClass} onClick={onNav}>
          {({ isActive }) => (
            <>
              <CheckSquare
                className={`w-5 h-5 mr-3 shrink-0 transition-colors ${isActive ? "text-[var(--color-lavender)]" : "group-hover:text-[var(--color-lavender-light)]"}`}
              />
              <span>Tasks</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-4 rounded-full bg-[var(--color-lavender)] shadow-[0_0_8px_var(--color-lavender)]" />
              )}
            </>
          )}
        </NavLink>

        <NavLink to="/calendar" className={navLinkClass} onClick={onNav} data-testid="callender-tab" title="Calendar">
          {({ isActive }) => (
            <>
              <CalendarIcon
                className={`w-5 h-5 mr-3 shrink-0 transition-colors ${isActive ? "text-[var(--color-lavender)]" : "group-hover:text-[var(--color-lavender-light)]"}`}
              />
              <span>Calendar</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-4 rounded-full bg-[var(--color-lavender)] shadow-[0_0_8px_var(--color-lavender)]" />
              )}
            </>
          )}
        </NavLink>
      </nav>

      {/* Bottom Profile & Community */}
      <div className="p-4 border-t border-[var(--color-border)] space-y-3 bg-[var(--color-bg-surface)]/80">
        {user && (
          <div className="p-3 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] transition-all hover:border-[var(--color-border-lavender)]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-lavender)] to-[var(--color-lavender-dark)] text-[#0f1015] text-sm font-black shrink-0 shadow-[0_0_12px_rgba(189,166,247,0.3)]">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--color-mint)] border-2 border-[var(--color-bg-elevated)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                  {user.name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-mint-muted)] text-[var(--color-mint-dark)] border border-[rgba(171,236,218,0.2)]">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-all rounded-xl hover:bg-[var(--color-bg-hover)] hover:text-white cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-3 shrink-0" />
          Logout
        </button>

        <a
          href="https://chat.whatsapp.com/GAfR7wfbKq7FArA0Ki18ve"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-[#0f1015] transition-all duration-250 rounded-xl bg-gradient-to-r from-[var(--color-mint)] to-[var(--color-mint-dark)] hover:from-[var(--color-mint-light)] hover:to-[var(--color-mint)] shadow-[0_4px_16px_rgba(171,236,218,0.3)] hover:shadow-[0_6px_22px_rgba(171,236,218,0.45)] hover:scale-[1.02] active:scale-[0.98]"
        >
          <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
          Join Community
        </a>
      </div>
    </div>
  );
};

// ── Main Sidebar component ───────────────────────────────────────────────────
export const Sidebar = () => {
  const { open, setOpen } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={[
        'fixed inset-y-0 left-0 z-50 w-72 bg-[var(--color-bg-surface)] border-r border-[var(--color-border)] transition-transform duration-300 ease-out lg:hidden shadow-2xl',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent onNav={() => setOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-64 xl:w-72 bg-[var(--color-bg-surface)] border-r border-[var(--color-border)] h-screen shrink-0 relative z-20">
        <SidebarContent />
      </div>
    </>
  );
};
