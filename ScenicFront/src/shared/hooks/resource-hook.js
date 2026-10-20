import { useCallback, useEffect, useState } from "react";

import { apiRequest, isAbort, withFreshness } from "../util/api";

/**
 * Load one API resource for a page.
 * @param {string | null} url what to load; null loads nothing ("idle")
 * @param {{ fresh?: boolean }} [options] `fresh`: add fresh=<time> after a
 *   recent change (withFreshness), when the request is sent rather than in
 *   render, so a change made on this page doesn't reload it.
 * @returns {{
 *   status: "idle" | "loading" | "ready" | "error",
 *   data: any,
 *   error: import("../util/api").ApiError | null,
 *   retry: () => void,
 *   update: (change: (data: any) => any) => void,
 * }}
 */
export function useApiResource(url, { fresh = false } = {}) {
  const [attempt, setAttempt] = useState(0);
  const key = url ? `${attempt} ${url}` : null;
  // The result remembers which request it answers, so a new URL (or a
  // retry) reads as "loading" straight away, without a state reset.
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    apiRequest(fresh ? withFreshness(url) : url, { signal: controller.signal }).then(
      (data) => setResult({ key, data, error: null }),
      (error) => {
        if (!isAbort(error)) setResult({ key, data: null, error });
      },
    );
    return () => controller.abort();
  }, [key, url, fresh]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const update = useCallback(
    (change) => setResult((current) => ({ ...current, data: change(current.data) })),
    [],
  );

  const current = key !== null && result.key === key;
  let status = "idle";
  if (key) status = !current ? "loading" : result.error ? "error" : "ready";
  return {
    status,
    data: current ? result.data : null,
    error: current ? result.error : null,
    retry,
    update,
  };
}
