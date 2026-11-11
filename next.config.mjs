/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Placeholder artwork is SVG. Real photos (jpg/png/webp/avif) are optimised as normal.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Short, pitch-friendly material URLs map onto the single dynamic collection route.
  async rewrites() {
    return [
      { source: "/gold", destination: "/collections/gold" },
      { source: "/silver", destination: "/collections/silver" },
      { source: "/diamonds", destination: "/collections/diamonds" },
    ];
  },
};

export default nextConfig;
