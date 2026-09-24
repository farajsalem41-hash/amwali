import { useCallback, useEffect, useRef, useState } from 'react';
import { api, readError } from './api';

export interface Meta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Small data-loading hook: keeps loading/error state and allows manual reload. */
export function useApi<T>(path: string | null, params?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState('');
  const key = JSON.stringify(params ?? {});
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(path, { params: JSON.parse(key) });
      if (alive.current) setData(res.data as T);
    } catch (err) {
      if (alive.current) setError(readError(err).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

export function useDebounced<T>(value: T, delay = 400): T {
  const [state, setState] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setState(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return state;
}

/** Downloads a file from an authenticated endpoint via a blob URL. */
export async function downloadFile(path: string, filename: string, params?: Record<string, unknown>) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
