import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep visited pages in the browser for 30 s so switching tabs doesn't refetch
    // them; server actions that change data clear this cache (revalidatePath).
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
