// apps/web/src/lib/api.ts

import { useAuthStore } from '../store/auth';

/**
 * Domyślny timeout dla żądań API (30 sekund).
 */
const API_TIMEOUT_MS = 30_000;

/**
 * Generyczny wrapper dla fetch, zapewniający jednolitą obsługę błędów,
 * timeout (AbortController) i ekstrakcję JSON.
 */
export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = ''; // Vite proxy obsługuje /api/* → backend
  const path = endpoint.startsWith('/api') ? endpoint : `/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const url = `${baseUrl}${path}`;
  
  const headers: HeadersInit = { ...options.headers };
  
  if (options.body && !(options.body instanceof FormData)) {
    (headers as any)['Content-Type'] = 'application/json';
  }

  // Wstrzyknij nagłówek symulacji dla SuperAdmina (Faza 7)
  const simulatedId = useAuthStore.getState().simulatedInstituteId;
  if (simulatedId) {
    (headers as any)['X-Simulate-Institute'] = simulatedId;
  }

  // Timeout via AbortController (Audyt #5)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  // Jeśli caller już podał signal, połącz oba
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const errorData = typeof data === 'object' && data !== null ? data : {};
      throw new Error(errorData?.details || errorData?.message || errorData?.error || `API Error: ${response.status} ${response.statusText}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Żądanie przekroczyło limit czasu (${API_TIMEOUT_MS / 1000}s). Sprawdź połączenie z serwerem.`);
    }
    throw err;
  }
}

// Interfejsy pomocnicze
export interface ApiListResponse<T> {
  data: T[];
}

export interface ApiSingleResponse<T> {
  data: T;
}
