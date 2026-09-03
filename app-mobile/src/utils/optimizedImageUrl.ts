// Uploaded photos go straight to Vercel Blob at full camera resolution
// (several MB each), so downloading one to show as a 48px logo or a
// 400px card thumbnail wastes bandwidth and time on every first view.
// Route them through the website's Next.js image optimizer instead —
// it resizes and re-compresses at the edge (and caches the result), so
// the app only ever downloads an image sized for where it's shown.
const SITE_ORIGIN = 'https://akiofertas.com.br'

export function optimizedImageUrl(url: string, width: number, quality = 75): string {
  if (!url.includes('.public.blob.vercel-storage.com')) return url
  const params = new URLSearchParams({ url, w: String(width), q: String(quality) })
  return `${SITE_ORIGIN}/_next/image?${params.toString()}`
}
