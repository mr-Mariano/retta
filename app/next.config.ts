import type { NextConfig } from "next";

// Uploaded field photos are served from the project's public Storage bucket.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  experimental: {
    // Keep visited pages in the browser for 30 s so switching tabs doesn't refetch
    // them; server actions that change data clear this cache (revalidatePath).
    staleTimes: { dynamic: 30 },
  },
  images: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "http" | "https",
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: "/storage/v1/object/public/field-photos/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
