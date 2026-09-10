import { useState } from "react";

/**
 * The selection state every grid that lets someone pick a subset of photos
 * before acting on them in bulk shares — `FaceSearchPanel`'s results, the
 * public `EventGallery`, and the studio's `DeletePhotosForm`. Takes the full
 * list of ids currently on screen so "select all" knows what "all" means.
 *
 * `setSelectedIds` is exposed directly for the cases plain `toggleSelect`
 * doesn't cover — resetting on a fresh search, or (with `flushSync`)
 * checking every box synchronously right before a native form submission
 * reads them.
 */
export function usePhotoSelection(ids: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = ids.length > 0 && selectedIds.size === ids.length;

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  }

  return { selectedIds, setSelectedIds, toggleSelect, allSelected, toggleSelectAll };
}
