/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lhrkvbjdozocmdsucgyp.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;