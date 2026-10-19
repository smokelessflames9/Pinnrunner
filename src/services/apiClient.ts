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
 * for relative `/api/*` paths while falling back to same-origin `/api/*` if the
 * external backend is unreachable or blocked by CORS.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.trim();
  if (/^https?:\/\//i.test(cleanPath)) {
    return fetch(cleanPath, init);
  }

  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const remoteUrl = `${API_BASE_URL}${normalizedPath}`;

  // If running on a full-stack host (localhost or Cloud Run), try same-origin first
  const isSameOriginHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.run.app'));

  if (isSameOriginHost) {
    try {
      const localRes = await fetch(normalizedPath, init);
      const contentType = localRes.headers.get('content-type') || '';
      if (localRes.ok || contentType.includes('application/json')) {
        return localRes;
      }
    } catch {
      // Fallback to remoteUrl
    }
  }

  try {
    return await fetch(remoteUrl, init);
  } catch (remoteErr) {
    // If remote backend failed (e.g. iOS Safari "Load failed" due to CORS or sleeping Render instance),
    // try same-origin /api/* in case a proxy or full-stack server is mounted on the current domain.
    if (!isSameOriginHost && typeof window !== 'undefined') {
      try {
        const fallbackRes = await fetch(normalizedPath, init);
        const contentType = fallbackRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return fallbackRes;
        }
      } catch {
        // Ignore fallback error and rethrow original
      }
    }
    throw remoteErr;
  }
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

