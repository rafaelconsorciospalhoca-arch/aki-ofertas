/** @type {import('next').NextConfig} */
const nextConfig = {
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
