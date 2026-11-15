import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/**
 * Tải dữ liệu từ API. `path = null` → không tải.
 * reload() giữ dữ liệu cũ trên màn hình trong lúc tải lại (không nháy skeleton).
 */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const ctrl = useRef(null);

  const load = useCallback(async () => {
    if (!path) return setState({ data: null, error: null, loading: false });
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path, { signal: c.signal });
      if (!c.signal.aborted) setState({ data, error: null, loading: false });
    } catch (err) {
      if (err.name !== "AbortError") setState((s) => ({ ...s, error: err, loading: false }));
    }
  }, [path]);

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
