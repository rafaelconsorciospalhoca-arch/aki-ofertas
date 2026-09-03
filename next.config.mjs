/** @type {import('next').NextConfig} */
const nextConfig = {
  // Uploaded photos (business logos, menu items, offer covers) go straight
  // to Vercel Blob at full camera resolution — several MB each — with no
  // resizing. The mobile app requests them through /_next/image (via a
  // small helper, see app-mobile/src/utils/optimizedImageUrl.ts) so this
  // needs to know the blob host is safe to fetch and resize.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
    // Next.js's optimizer only serves widths present in one of these two
    // lists (anything else 400s) — these are exactly the widths the mobile
    // app requests (see app-mobile/src/utils/optimizedImageUrl.ts).
    imageSizes: [48, 72, 96, 150, 300],
    deviceSizes: [400, 800],
  },
  // Serves the Expo web build (public/app/**, a static SPA export) at
  // /app/**. Real files there (JS bundles, assets, favicon) are matched
  // first by Next's normal static handling; this fallback only kicks in
  // for client-side routes like /app/oferta/x that have no matching file,
  // so expo-router's history-API routing can take over after load.
  async rewrites() {
    return {
      fallback: [{ source: '/app/:path*', destination: '/app/index.html' }],
    };
  },
};

export default nextConfig;
