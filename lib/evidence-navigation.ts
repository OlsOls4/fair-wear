/** Navigation only: public observation IDs, never review choices or private fields. */
export function evidenceFindingHref(id: string): string {
  return `/demo#finding=${encodeURIComponent(id)}`;
}

export function evidenceFindingFromHash(hash: string, allowedIds: readonly string[]): string | null {
  if (!hash.startsWith("#finding=") || hash.length > 512) return null;
  try {
    const id = decodeURIComponent(hash.slice("#finding=".length));
    return allowedIds.includes(id) ? id : null;
  } catch { return null; }
}
