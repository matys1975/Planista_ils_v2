import { createRouter, createRoute, createRootRoute, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { AppRoot } from './layout/AppRoot';
import { LoginPage } from './pages/Login';
import { DashboardLayout } from './layout/DashboardLayout';
import { useAuthStore } from './store/auth';
import { isSessionVerified, markSessionVerified } from './lib/queryClient';

const rootRoute = createRootRoute({
  component: AppRoot,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});




const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  component: DashboardLayout,

  /* ═══ Auth Guard — blokuje render całego dashboardu przed weryfikacją ═══ */
  beforeLoad: async ({ location }) => {
    const { isAuthenticated, checkSession } = useAuthStore.getState();

    // 1. sessionStorage mówi "niezalogowany" → natychmiastowy redirect, zero renderowania
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }

    // 2. sessionStorage mówi "zalogowany", ale jeszcze nie zweryfikowaliśmy z backendem
    //    (np. po F5 — JWT mógł wygasnąć, ktoś mógł ręcznie zmodyfikować sessionStorage)
    if (!isSessionVerified()) {
      await checkSession();
      const currentState = useAuthStore.getState();
      if (!currentState.isAuthenticated) {
        throw redirect({ to: '/login' });
      }
      markSessionVerified();
    }

    const currentState = useAuthStore.getState();
    if (currentState.mustChangePassword && location.pathname !== '/profil') {
      throw redirect({ to: '/profil' });
    }
  },

  /* Spinner wyświetlany ZAMIAST dashboardu podczas weryfikacji sesji z backendem */
  pendingComponent: () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#faf9f6',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, margin: '0 auto 16px',
          border: '3px solid #e5e7eb', borderTopColor: '#1e293b',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#64748b', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Weryfikacja sesji…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./pages/Home'), 'Home'),
});

const dictionaryRoomsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/dictionary/rooms',
  component: lazyRouteComponent(() => import('./pages/DictionaryRooms'), 'DictionaryRooms'),
});

const dictionaryTeachersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/dictionary/teachers',
  component: lazyRouteComponent(() => import('./pages/DictionaryTeachers'), 'DictionaryTeachers'),
});

const dictionaryCoursesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/dictionary/courses',
  component: lazyRouteComponent(() => import('./pages/DictionaryCourses'), 'DictionaryCourses'),
});

const configurationRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/configuration',
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  component: lazyRouteComponent(() => import('./pages/Configuration'), 'Configuration'),
});

const scheduleGridRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/harmonogram',
  component: lazyRouteComponent(() => import('./pages/ScheduleGrid'), 'ScheduleGrid'),
});

const workloadRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/obciazenia',
  component: lazyRouteComponent(() => import('./pages/WorkloadDashboard'), 'WorkloadDashboard'),
});

const usersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/users',
  component: lazyRouteComponent(() => import('./pages/UserManagement'), 'UserManagement'),
});

const profileRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/profil',
  component: lazyRouteComponent(() => import('./pages/ProfilePage'), 'ProfilePage'),
});

const manualRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/podrecznik',
  component: lazyRouteComponent(() => import('./pages/ManualPage'), 'ManualPage'),
});

const staffingRequestsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/requests',
  component: lazyRouteComponent(() => import('./pages/StaffingRequests'), 'StaffingRequests'),
});

const FacultyDashboardLazy = lazyRouteComponent(() => import('./pages/FacultyDashboard'), 'FacultyDashboard');

const facultyDashboardRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/faculty/dashboard',
  component: FacultyDashboardLazy,
});

/* Legacy aliases — old bookmarks still work */
const deanDashboardRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/dean/dashboard',
  component: FacultyDashboardLazy,
});

const superadminRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/superadmin/dashboard',
  component: FacultyDashboardLazy,
});

const auditLogRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/audit',
  component: lazyRouteComponent(() => import('./pages/AuditLog'), 'AuditLog'),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute.addChildren([
    indexRoute,
    dictionaryRoomsRoute,
    dictionaryTeachersRoute,
    dictionaryCoursesRoute,

    configurationRoute,
    scheduleGridRoute,
    workloadRoute,
    usersRoute,
    profileRoute,
    manualRoute,
    staffingRequestsRoute,
    facultyDashboardRoute,
    deanDashboardRoute,
    superadminRoute,
    auditLogRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
