import { useEffect } from "react";

/** Sets the tab title to "<title> · Scenic" (or the given full title) while the page shows. */
export function useDocumentTitle(title, { full = false } = {}) {
  useEffect(() => {
    if (!title) return;
    document.title = full ? title : `${title} · Scenic`;
  }, [title, full]);
}
