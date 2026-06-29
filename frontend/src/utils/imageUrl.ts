/**
 * Normalize image URLs from the API to absolute paths.
 *
 * Seed data stores paths like `/static/knowledge/xxx.jpg` (absolute).
 * Expansion data stored paths like `images/xxx.jpg` (relative) — these
 * need `/static/` prepended so the browser resolves them correctly.
 *
 * This function ensures both formats work regardless of where they're used.
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  if (!url) return ''
  // Already absolute (starts with / or http)
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  // Relative path — prepend /static/
  return `/static/${url}`
}
