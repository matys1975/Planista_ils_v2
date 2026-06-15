import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fetchApi } from '../lib/api';
import { queryClient, resetSessionVerified } from '../lib/queryClient';


type Role = 'SUPER_ADMIN' | 'DEAN' | 'ADMIN' | 'PLANNER' | 'VIEWER';

interface AuthState {
  isAuthenticated: boolean;
  role: Role | null;
  name: string | null;
  instituteId: string | null;
  facultyId: string | null;
  simulatedInstituteId: string | null;
  activeSemesterId: string | null;
  setActiveSemesterId: (id: string | null) => void;
  setSimulatedInstituteId: (id: string | null) => void;
  login: (role: Role, name: string, instituteId?: string | null, facultyId?: string | null) => void;
  logout: () => void;
  checkSession: () => Promise<void>;
}

/**
 * Audyt #11: Retry z opóźnieniem wykładniczym dla checkSession.
 * Zabezpiecza przed wylogowaniem przy chwilowych błędach sieci.
 */
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Retry exhausted');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      role: null,
      name: null,
      instituteId: null,
      facultyId: null,
      simulatedInstituteId: null,
      activeSemesterId: null,
      setActiveSemesterId: (id) => set({ activeSemesterId: id }),
      setSimulatedInstituteId: (id) => set({ simulatedInstituteId: id }),
      login: (role, name, instituteId = null, facultyId = null) => set({ isAuthenticated: true, role, name, instituteId, facultyId }),
      logout: () => {
        fetchApi('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => { });
        queryClient.clear();
        resetSessionVerified();
        set({ isAuthenticated: false, role: null, name: null, instituteId: null, facultyId: null, simulatedInstituteId: null });
      },
      checkSession: async () => {
        try {
          const res = await fetchWithRetry(() => fetchApi('/auth/me', { credentials: 'include' }));
          if (res && res.user) {
            set({ isAuthenticated: true, role: res.user.role, name: res.user.name, instituteId: res.user.instituteId || null, facultyId: res.user.facultyId || null });
          } else {
            set({ isAuthenticated: false, role: null, name: null, instituteId: null, facultyId: null });
          }
        } catch {
          set({ isAuthenticated: false, role: null, name: null, instituteId: null, facultyId: null });
        }
      },
    }),
    {
      name: 'planista-auth',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

