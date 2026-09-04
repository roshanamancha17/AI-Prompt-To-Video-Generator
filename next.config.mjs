/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // ffmpeg-static resolves the real ffmpeg binary's path relative to its
    // own module location at require() time. If webpack bundles it into
    // .next/server/vendor-chunks, that path math resolves against the
    // bundle's fake location instead of the real node_modules/ffmpeg-static
    // folder -> ENOENT spawning a binary that was never copied there.
    // Marking it external keeps it a plain runtime require().
    serverComponentsExternalPackages: ['ffmpeg-static'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
};

export default nextConfig;