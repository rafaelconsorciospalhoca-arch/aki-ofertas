// Uploaded photos go straight to Vercel Blob at full camera resolution
// (several MB each), so downloading one to show as a 48px logo or a
// 400px card thumbnail wastes bandwidth and time on every first view.
// Route them through the website's Next.js image optimizer instead —
// it resizes and re-compresses at the edge (and caches the result), so
// the app only ever downloads an image sized for where it's shown.
const SITE_ORIGIN = 'https://akiofertas.com.br'

export type OptimizedImageSource = { uri: string; headers?: Record<string, string> }

// The optimizer picks the response format (webp vs. the source's own format)
// from the request's Accept header, the way a browser's <img> tag would ask
// for it — but expo-image's native loaders don't send one, so requests were
// silently falling back to the original (much larger) PNG/JPEG on every
// image. Asking for image/webp explicitly here cuts payload size roughly
// in half.
export function optimizedImageUrl(url: string, width: number, quality = 75): OptimizedImageSource {
  if (!url.includes('.public.blob.vercel-storage.com')) return { uri: url }
  const params = new URLSearchParams({ url, w: String(width), q: String(quality) })
  return {
    uri: `${SITE_ORIGIN}/_next/image?${params.toString()}`,
    headers: { Accept: 'image/webp' },
  }
}
