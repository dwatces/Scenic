import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { API_URL } from "../../config";
import { apiRequest, isAbort, withFreshness } from "../../shared/util/api";

/** "12 more scenes loaded." / "1 more scene loaded." */
export function describeLoaded(count) {
  return `${count} more ${count === 1 ? "scene" : "scenes"} loaded.`;
}

const empty = {
  key: null,
  scenes: [],
  nextCursor: null,
  error: null,
  loadingMore: false,
  moreError: null,
  announcement: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "loaded":
      return {
        ...empty,
        key: action.key,
        scenes: action.scenes,
        nextCursor: action.nextCursor,
      };
    case "failed":
      return { ...empty, key: action.key, error: action.error };
    case "moreStarted":
      return { ...state, loadingMore: true, moreError: null };
    case "moreLoaded": {
      const seen = new Set(state.scenes.map((scene) => scene.id));
      const added = action.scenes.filter((scene) => !seen.has(scene.id));
      return {
        ...state,
        scenes: [...state.scenes, ...added],
        nextCursor: action.nextCursor,
        loadingMore: false,
        announcement: describeLoaded(added.length),
      };
    }
    case "moreFailed":
      return { ...state, loadingMore: false, moreError: action.error };
    case "removed":
      return { ...state, scenes: state.scenes.filter((scene) => scene.id !== action.id) };
    default:
      return state;
  }
}

/** The feed URL for a page: GET /api/scenes?limit=..&creator=..&before=.. */
export function feedUrl({ limit, creator, before } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (creator) params.set("creator", creator);
  if (before) params.set("before", before);
  const query = params.toString();
  return withFreshness(`${API_URL}/scenes${query ? `?${query}` : ""}`);
}

/**
 * Scenes from the feed, newest first, a page at a time ("Load more").
 * @param {{ limit?: number, creator?: string | null, enabled?: boolean }} options
 */
export function useSceneFeed({ limit = 12, creator = null, enabled = true } = {}) {
  const [state, dispatch] = useReducer(reducer, empty);
  const [attempt, setAttempt] = useState(0);
  const more = useRef(null);

  const firstPage = enabled ? feedUrl({ limit, creator }) : null;
  const key = firstPage ? `${attempt} ${firstPage}` : null;

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    apiRequest(firstPage, { signal: controller.signal }).then(
      (data) => dispatch({ type: "loaded", key, scenes: data.scenes, nextCursor: data.nextCursor }),
      (error) => {
        if (!isAbort(error)) dispatch({ type: "failed", key, error });
      },
    );
    return () => controller.abort();
  }, [key, firstPage]);

  // Cancel a "Load more" still running when the page goes away.
  useEffect(() => () => more.current && more.current.abort(), []);

  const current = key !== null && state.key === key;

  const loadMore = useCallback(async () => {
    if (!state.nextCursor || state.loadingMore) return;
    const controller = new AbortController();
    more.current = controller;
    dispatch({ type: "moreStarted" });
    try {
      const data = await apiRequest(feedUrl({ limit, creator, before: state.nextCursor }), {
        signal: controller.signal,
      });
      dispatch({ type: "moreLoaded", scenes: data.scenes, nextCursor: data.nextCursor });
    } catch (error) {
      if (!isAbort(error)) dispatch({ type: "moreFailed", error });
    }
  }, [state.nextCursor, state.loadingMore, limit, creator]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const remove = useCallback((id) => dispatch({ type: "removed", id }), []);

  let status = "idle";
  if (key) status = !current ? "loading" : state.error ? "error" : "ready";
  return {
    status,
    scenes: current ? state.scenes : [],
    error: current ? state.error : null,
    hasMore: current && Boolean(state.nextCursor),
    loadingMore: state.loadingMore,
    moreError: state.moreError,
    announcement: current ? state.announcement : "",
    loadMore,
    retry,
    remove,
  };
}
