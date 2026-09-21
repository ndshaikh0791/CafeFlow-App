import { useCallback, useEffect, useRef, useState } from "react";
import { api, message } from "../services/api";
export function useData(url, interval = 0, allPages = false) {
  const request = useRef(0);
  const [data, setData] = useState(null),
    [meta, setMeta] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!url) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(url);
      let result = res.data.data;
      if (allPages && res.data.meta?.pages > 1) {
        const remaining = await Promise.all(
          Array.from({ length: res.data.meta.pages - 1 }, (_, i) =>
            api.get(url, { params: { page: i + 2 } }),
          ),
        );
        result = [...result, ...remaining.flatMap((r) => r.data.data)];
      }
      if (id !== request.current) return;
      setData(result);
      setMeta(res.data.meta);
      setError("");
    } catch (e) {
      if (id === request.current) setError(message(e));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [url, allPages]);
  useEffect(() => {
    setLoading(true);
    reload();
    const listener = () => reload();
    window.addEventListener("cf-refresh", listener);
    const timer = interval ? setInterval(reload, interval) : null;
    return () => {
      request.current++;
      window.removeEventListener("cf-refresh", listener);
      clearInterval(timer);
    };
  }, [reload, interval]);
  return { data, meta, loading, error, reload, setData };
}
export function useCollection(resource) {
  return useData(resource ? `${resource}?limit=200` : null, 0, true);
}
export const refresh = () => window.dispatchEvent(new Event("cf-refresh"));
