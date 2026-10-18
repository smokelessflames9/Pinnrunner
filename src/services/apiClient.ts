/**
 * Centralized API Client & Base URL Configuration for PINN Arcade
 * Connects the React/Vite frontend to the deployed Render Express/TypeScript backend.
 */

const DEFAULT_API_BASE_URL = 'https://pinn-arcade-api.onrender.com';

function resolveApiBaseUrl(): string {
  const envBase =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL);

  if (typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.trim().replace(/\/+$/, '');
  }

  return DEFAULT_API_BASE_URL;
}

export const API_BASE_URL: string = resolveApiBaseUrl();

/**
 * Constructs a complete backend API URL for relative `/api/*` endpoints.
 * Safely leaves external absolute URLs (e.g. Solana RPCs, Supabase) untouched.
 */
export function buildApiUrl(path: string): string {
  const cleanPath = path.trim();
  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath;
  }
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Wrapper around fetch() that automatically targets the configured Render backend
 * for relative `/api/*` paths while preserving method, headers, body, and response parsing.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(buildApiUrl(path), init);
}

/**
 * Checks connectivity and status of the PINN Arcade Express backend (`/api/health`).
 */
export async function checkBackendHealth(): Promise<{
  ok: boolean;
  status?: string;
  project?: string;
  tokenMint?: string;
  solanaRpcEndpoints?: number;
  timestamp?: string;
  error?: string;
}> {
  try {
    const res = await apiFetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      ok: data?.status === 'ok',
      ...data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
