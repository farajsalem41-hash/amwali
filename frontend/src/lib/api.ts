import axios, { AxiosError } from 'axios';

// 1) VITE_API_URL wins in real deployments (Vercel, VPS, ...).
// 2) In sandbox previews the placeholder below is rewritten to the proxied API URL.
// 3) Local development falls back to the dev API port.
const PLACEHOLDER = '__PORT_5000__';
const ENV_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
export const API_BASE = ENV_URL || (PLACEHOLDER.startsWith('__') ? 'http://localhost:5000' : PLACEHOLDER);

export const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 30000 });

let accessToken: string | null = null;

/** Storage can be blocked (sandboxed iframes) — the in-memory token is the source of truth. */
function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__amwali_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function setToken(token: string | null, remember = true) {
  accessToken = token;
  const s = safeStorage();
  if (!s) return;
  try {
    if (token && remember) s.setItem('amwali_token', token);
    else s.removeItem('amwali_token');
  } catch {
    /* ignore */
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  const s = safeStorage();
  if (!s) return null;
  try {
    accessToken = s.getItem('amwali_token');
  } catch {
    accessToken = null;
  }
  return accessToken;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface ApiErrorShape {
  message: string;
  code?: string;
  details?: { field: string; message: string }[];
}

export function readError(err: unknown): ApiErrorShape {
  const e = err as AxiosError<{ error?: ApiErrorShape }>;
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.code === 'ERR_NETWORK') return { message: 'تعذر الاتصال بالخادم، تأكد من الاتصال وحاول مرة أخرى' };
  return { message: 'حدث خطأ غير متوقع، حاول مرة أخرى' };
}

export function fieldErrors(err: unknown): Record<string, string> {
  const details = readError(err).details || [];
  const out: Record<string, string> = {};
  for (const d of details) out[d.field] = d.message;
  return out;
}
