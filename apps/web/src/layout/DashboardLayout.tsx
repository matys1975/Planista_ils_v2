import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import {
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  Building2,
  GraduationCap,
  ClipboardList,
  Grid3X3,
  Shield,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function NavTooltip({ children, label, isCollapsed }: { children: React.ReactNode, label: string, isCollapsed: boolean }) {
  if (!isCollapsed) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="right">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ═══ Institutional Slate — Sidebar color constants ═══ */
const NAV_LINK = `flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-all
  text-white/70 hover:bg-white/[0.08] hover:text-white
  [&.active]:bg-white/[0.12] [&.active]:text-gold [&.active]:border-l-2 [&.active]:border-gold`;

export function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDictionariesOpen, setIsDictionariesOpen] = useState(true);
  const { role, name, logout } = useAuthStore();
  const navigate = useNavigate();

  // Automatyczne zwijanie na małych ekranach
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate({ to: '/login' });
  };

  const linkCls = (collapsed: boolean) =>
    `${NAV_LINK} ${collapsed ? 'px-0 justify-center w-12 h-12 mx-auto' : 'px-4'}`;

  const linkClsSm = (collapsed: boolean) =>
    `${NAV_LINK} ${collapsed ? 'px-0 justify-center w-10 h-10' : 'px-4'}`;

  return (
    <div className="flex h-screen bg-cream overflow-hidden selection:bg-navy-mid/30 font-sans text-navy-deep">
      {/* Sidebar — Institutional Slate Navy Deep */}
      <aside
        className={`bg-navy-deep text-white/70 transition-all duration-300 ease-in-out border-r border-navy-dark/30 flex flex-col z-50 print:hidden ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Logo Section */}
        <div className={`p-4 flex items-center justify-center border-b border-white/10 bg-black/10 relative`}>
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div className="p-1.5 bg-gold/15 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></svg>
            </div>
            {!isCollapsed && (
              <span className="text-white font-bold text-lg tracking-tight font-display animate-in fade-in slide-in-from-left-2 duration-300">
                Planista
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-navy-deep border border-navy-dark rounded-full flex items-center justify-center text-white/50 hover:text-white hover:border-gold/50 transition-all z-50 shadow-lg cursor-pointer"
            title={isCollapsed ? "Rozwiń menu" : "Zwiń menu"}
          >
            <ChevronLeft className={`h-3 w-3 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide space-y-8">
          <div className="space-y-1">
            {!isCollapsed && <h2 className="text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 px-4">Główny Panel</h2>}

            <NavTooltip label="Dashboard" isCollapsed={isCollapsed}>
              <Link to="/" className={linkCls(isCollapsed)}>
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Przegląd</span>}
              </Link>
            </NavTooltip>

            <NavTooltip label="Podręcznik" isCollapsed={isCollapsed}>
              <Link to="/podrecznik" className={linkCls(isCollapsed)}>
                <BookOpen className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Podręcznik</span>}
              </Link>
            </NavTooltip>
          </div>

          <div className="space-y-1">
            {!isCollapsed && <h2 className="text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 px-4">Planowanie</h2>}

            <NavTooltip label="Plan zajęć" isCollapsed={isCollapsed}>
              <Link to="/harmonogram" className={linkCls(isCollapsed)}>
                <Grid3X3 className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Plan zajęć</span>}
              </Link>
            </NavTooltip>

            <NavTooltip label="Karty Pensum" isCollapsed={isCollapsed}>
              <Link to="/obciazenia" className={linkCls(isCollapsed)}>
                <ClipboardList className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Karty Pensum</span>}
              </Link>
            </NavTooltip>

            {role !== 'SUPER_ADMIN' && role !== 'DEAN' && (
              <NavTooltip label="Zapotrzebowania" isCollapsed={isCollapsed}>
                <Link to="/requests" className={linkCls(isCollapsed)}>
                  <AlertCircle className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Zapotrzebowania</span>}
                </Link>
              </NavTooltip>
            )}

            <div className={isCollapsed ? 'mt-4 border-t border-white/10 pt-4 flex flex-col items-center gap-1' : 'mt-0'}>
              {!isCollapsed && (
                <button
                  onClick={() => setIsDictionariesOpen(!isDictionariesOpen)}
                  className="w-full flex items-center justify-between text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 mt-8 px-4 hover:text-white/70 transition-colors"
                >
                  Słowniki
                  <ChevronLeft className={`w-3 h-3 transition-transform duration-300 ${isDictionariesOpen ? '-rotate-90' : ''}`} />
                </button>
              )}

              {(isDictionariesOpen || isCollapsed) && (
                <div className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                  <NavTooltip label="Prowadzący" isCollapsed={isCollapsed}>
                    <Link to="/dictionary/teachers" className={linkClsSm(isCollapsed)}>
                      <GraduationCap className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Prowadzący</span>}
                    </Link>
                  </NavTooltip>
                  <NavTooltip label="Przedmioty" isCollapsed={isCollapsed}>
                    <Link to="/dictionary/courses" className={linkClsSm(isCollapsed)}>
                      <BookOpen className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Przedmioty</span>}
                    </Link>
                  </NavTooltip>
                  <NavTooltip label="Konfiguracja" isCollapsed={isCollapsed}>
                    <Link to="/configuration" className={linkClsSm(isCollapsed)}>
                      <Settings className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Konfiguracja</span>}
                    </Link>
                  </NavTooltip>
                </div>
              )}
            </div>

            {(role === 'ADMIN' || role === 'SUPER_ADMIN') && (
              <div className={isCollapsed ? 'mt-4 border-t border-white/10 pt-4 flex flex-col items-center' : 'mt-0'}>
                {!isCollapsed && <h2 className="text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 mt-8 px-4">Administracja</h2>}
                <NavTooltip label="Użytkownicy" isCollapsed={isCollapsed}>
                  <Link to="/admin/users" className={linkCls(isCollapsed)}>
                    <Shield className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Użytkownicy</span>}
                  </Link>
                </NavTooltip>
              </div>
            )}

            {(role === 'DEAN' || role === 'SUPER_ADMIN') && (
              <div className={isCollapsed ? 'mt-4 border-t border-white/10 pt-4 flex flex-col items-center gap-1' : 'mt-0'}>
                {!isCollapsed && <h2 className="text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 mt-8 px-4">Wydział</h2>}

                <NavTooltip label="Panel Wydziałowy" isCollapsed={isCollapsed}>
                  <Link to="/faculty/dashboard" className={linkCls(isCollapsed)}>
                    <Building2 className="h-5 w-5 flex-shrink-0" /> {!isCollapsed && <span>Panel Wydziałowy</span>}
                  </Link>
                </NavTooltip>
              </div>
            )}
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-white/10 bg-black/10">
          <div className={`flex items-center gap-3 mb-6 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-navy-deep font-bold text-xs shadow-lg">
              {name?.[0]}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate">{name}</span>
                <span className="text-[10px] text-gold/70 font-black uppercase truncate tracking-wider">{role}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Link to="/profil" className={`flex items-center gap-3 rounded-md py-2 text-[11px] font-bold uppercase tracking-wider transition-all hover:bg-white/[0.08] text-white/50 hover:text-white ${isCollapsed ? 'justify-center' : 'px-3'}`}>
              <User className="h-4 w-4" /> {!isCollapsed && <span>Mój Profil</span>}
            </Link>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 rounded-md py-2 text-[11px] font-bold uppercase tracking-wider transition-all hover:bg-status-danger-bg text-red-400/70 hover:text-red-300 ${isCollapsed ? 'justify-center' : 'px-3'}`}
            >
              <LogOut className="h-4 w-4" /> {!isCollapsed && <span>Wyloguj się</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-cream scrollbar-hide print:w-full print:overflow-visible">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
