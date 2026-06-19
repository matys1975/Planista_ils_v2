import { useState, useEffect, type ReactNode } from 'react';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import {
  AlertCircle,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Shield,
  User,
  Users2,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function NavTooltip({
  children,
  label,
  isCollapsed,
}: {
  children: ReactNode;
  label: string;
  isCollapsed: boolean;
}) {
  if (!isCollapsed) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const NAV_LINK = `flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-all
  text-white/70 hover:bg-white/[0.08] hover:text-white
  [&.active]:bg-white/[0.12] [&.active]:text-gold [&.active]:border-l-2 [&.active]:border-gold`;

export function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDictionariesOpen, setIsDictionariesOpen] = useState(true);
  const { role, name, logout } = useAuthStore();
  const navigate = useNavigate();

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
    <div className="flex h-screen overflow-hidden bg-cream font-sans text-navy-deep selection:bg-navy-mid/30">
      <aside
        className={`z-50 flex flex-col border-r border-navy-dark/30 bg-navy-deep text-white/70 transition-all duration-300 ease-in-out print:hidden ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="relative flex items-center justify-center border-b border-white/10 bg-black/10 p-4">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="rounded-lg bg-gold/15 p-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gold"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 12 12 17 22 12" />
                <polyline points="2 17 12 22 22 17" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="animate-in fade-in slide-in-from-left-2 font-display text-lg font-bold tracking-tight text-white duration-300">
                Planista
              </span>
            )}
          </Link>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-navy-dark bg-navy-deep text-white/50 shadow-lg transition-all hover:border-gold/50 hover:text-white"
            title={isCollapsed ? 'Rozwiń menu' : 'Zwiń menu'}
          >
            <ChevronLeft
              className={`h-3 w-3 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        <nav className="flex-1 space-y-8 overflow-y-auto px-3 py-6 scrollbar-hide">
          <div className="space-y-1">
            {!isCollapsed && (
              <h2 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
                Główny panel
              </h2>
            )}

            <NavTooltip label="Przegląd" isCollapsed={isCollapsed}>
              <Link to="/" className={linkCls(isCollapsed)}>
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>Przegląd</span>}
              </Link>
            </NavTooltip>
          </div>

          <div className="space-y-1">
            {!isCollapsed && (
              <h2 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
                Planowanie
              </h2>
            )}

            <NavTooltip label="Plan zajęć" isCollapsed={isCollapsed}>
              <Link to="/harmonogram" className={linkCls(isCollapsed)}>
                <Grid3X3 className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>Plan zajęć</span>}
              </Link>
            </NavTooltip>

            <NavTooltip label="Karty pensum" isCollapsed={isCollapsed}>
              <Link to="/obciazenia" className={linkCls(isCollapsed)}>
                <ClipboardList className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>Karty pensum</span>}
              </Link>
            </NavTooltip>

            {role !== 'SUPER_ADMIN' && role !== 'DEAN' && (
              <NavTooltip label="Zapotrzebowania" isCollapsed={isCollapsed}>
                <Link to="/requests" className={linkCls(isCollapsed)}>
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>Zapotrzebowania</span>}
                </Link>
              </NavTooltip>
            )}
          </div>

          <div className={isCollapsed ? 'space-y-1' : 'space-y-1'}>
            <div className={isCollapsed ? 'border-t border-white/10 pt-4' : ''}>
              {!isCollapsed && (
                <button
                  onClick={() => setIsDictionariesOpen(!isDictionariesOpen)}
                  className="mb-3 flex w-full items-center justify-between px-4 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:text-white/70"
                >
                  Słowniki
                  <ChevronLeft
                    className={`h-3 w-3 transition-transform duration-300 ${isDictionariesOpen ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {(isDictionariesOpen || isCollapsed) && (
                <div className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                  <NavTooltip label="Prowadzący" isCollapsed={isCollapsed}>
                    <Link to="/dictionary/teachers" className={linkClsSm(isCollapsed)}>
                      <User className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>Prowadzący</span>}
                    </Link>
                  </NavTooltip>

                  <NavTooltip label="Przedmioty" isCollapsed={isCollapsed}>
                    <Link to="/dictionary/courses" className={linkClsSm(isCollapsed)}>
                      <BookOpen className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>Przedmioty</span>}
                    </Link>
                  </NavTooltip>

                  <NavTooltip label="Kierunki" isCollapsed={isCollapsed}>
                    <Link
                      to="/configuration"
                      search={{ tab: 'majors' }}
                      activeOptions={{ includeSearch: true }}
                      className={linkClsSm(isCollapsed)}
                    >
                      <GraduationCap className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>Kierunki</span>}
                    </Link>
                  </NavTooltip>

                  <NavTooltip label="Grupy" isCollapsed={isCollapsed}>
                    <Link
                      to="/configuration"
                      search={{ tab: 'groups' }}
                      activeOptions={{ includeSearch: true }}
                      className={linkClsSm(isCollapsed)}
                    >
                      <Users2 className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>Grupy</span>}
                    </Link>
                  </NavTooltip>

                  <NavTooltip label="Sale" isCollapsed={isCollapsed}>
                    <Link
                      to="/configuration"
                      search={{ tab: 'rooms' }}
                      activeOptions={{ includeSearch: true }}
                      className={linkClsSm(isCollapsed)}
                    >
                      <Building2 className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>Sale</span>}
                    </Link>
                  </NavTooltip>

                  <NavTooltip label="Semestry" isCollapsed={isCollapsed}>
                    <Link
                      to="/configuration"
                      search={{ tab: 'semesters' }}
                      activeOptions={{ includeSearch: true }}
                      className={linkClsSm(isCollapsed)}
                    >
                      <CalendarDays className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>Semestry</span>}
                    </Link>
                  </NavTooltip>
                </div>
              )}
            </div>
          </div>

          {(role === 'ADMIN' || role === 'SUPER_ADMIN') && (
            <div className={isCollapsed ? 'border-t border-white/10 pt-4' : ''}>
              {!isCollapsed && (
                <h2 className="mb-3 mt-8 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Administracja
                </h2>
              )}

              <NavTooltip label="Użytkownicy" isCollapsed={isCollapsed}>
                <Link to="/admin/users" className={linkCls(isCollapsed)}>
                  <Shield className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>Użytkownicy</span>}
                </Link>
              </NavTooltip>
            </div>
          )}

          {(role === 'DEAN' || role === 'SUPER_ADMIN') && (
            <div className={isCollapsed ? 'border-t border-white/10 pt-4' : ''}>
              {!isCollapsed && (
                <h2 className="mb-3 mt-8 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
                Wydział
                </h2>
              )}

              <NavTooltip label="Panel wydziałowy" isCollapsed={isCollapsed}>
                <Link to="/faculty/dashboard" className={linkCls(isCollapsed)}>
                  <Building2 className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>Panel wydziałowy</span>}
                </Link>
              </NavTooltip>
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 bg-black/10 p-4">
          <div className={`mb-6 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-xs font-bold text-navy-deep shadow-lg">
              {name?.[0]}
            </div>

            {!isCollapsed && (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-white">{name}</span>
                <span className="truncate text-[10px] font-black uppercase tracking-wider text-gold/70">
                  {role}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Link
              to="/profil"
              className={`flex items-center gap-3 rounded-md py-2 text-[11px] font-bold uppercase tracking-wider text-white/50 transition-all hover:bg-white/[0.08] hover:text-white ${
                isCollapsed ? 'justify-center' : 'px-3'
              }`}
            >
              <User className="h-4 w-4" />
              {!isCollapsed && <span>Mój profil</span>}
            </Link>

            <Link
              to="/podrecznik"
              className={`flex items-center gap-3 rounded-md py-2 text-[11px] font-bold uppercase tracking-wider text-white/50 transition-all hover:bg-white/[0.08] hover:text-white ${
                isCollapsed ? 'justify-center' : 'px-3'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              {!isCollapsed && <span>Podręcznik</span>}
            </Link>

            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 rounded-md py-2 text-[11px] font-bold uppercase tracking-wider text-red-400/70 transition-all hover:bg-status-danger-bg hover:text-red-300 ${
                isCollapsed ? 'justify-center' : 'px-3'
              }`}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span>Wyloguj się</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto bg-cream print:w-full print:overflow-visible">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
