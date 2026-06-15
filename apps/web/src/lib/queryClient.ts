import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false, // Prevents spamming API when alt-tabbing
      retry: 1,
    },
  },
});

/**
 * Flaga sesyjna — resetuje się przy odświeżeniu strony (F5) lub wylogowaniu.
 * Zapobiega ponownemu wywołaniu /auth/me przy każdej nawigacji
 * wewnątrz aplikacji po jednokrotnej weryfikacji.
 */
let _sessionVerified = false;
export function isSessionVerified() { return _sessionVerified; }
export function markSessionVerified() { _sessionVerified = true; }
export function resetSessionVerified() { _sessionVerified = false; }
