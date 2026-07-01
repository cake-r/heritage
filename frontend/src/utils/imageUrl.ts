/**
 * Normalize image URLs from the API to absolute paths.
 *
 * Seed data stores paths like `/static/knowledge/xxx.jpg` (absolute).
 * Expansion data stored paths like `images/xxx.jpg` (relative) — these
 * need `/static/` prepended so the browser resolves them correctly.
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `/static/${url}`
}

/**
 * Convert image URL to WebP variant.
 * Appends ?format=webp for server-side conversion, or replaces extension for static files.
 * Falls back to original URL if unsupported.
 */
export function webpUrl(url: string | undefined | null): string {
  if (!url) return ''
  // External URLs — don't modify
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Static files — replace extension with .webp
  if (url.match(/\.(jpg|jpeg|png)$/i)) {
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp')
  }
  return url
}

/**
 * Generate a <picture> element's sources for WebP + fallback.
 * Returns { webp, fallback } URLs.
 */
export function pictureSources(url: string | undefined | null): { webp: string; fallback: string } {
  const normalized = normalizeImageUrl(url)
  return {
    webp: webpUrl(normalized),
    fallback: normalized,
  }
}
