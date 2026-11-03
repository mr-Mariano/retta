"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { TAB_PATHS } from "@/components/bottom-nav";

// Last tab shown, kept across navigations so the next page knows where it came from.
let previousTab = -1;

function tabIndex(pathname: string) {
  return TAB_PATHS.findIndex((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Re-mounts on every tab change (session 7): the new page slides in from the side of
 * the tab it comes from, matching the order in the bottom nav.
 */
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animation, setAnimation] = useState("");

  useLayoutEffect(() => {
    const current = tabIndex(pathname);
    if (previousTab >= 0 && current >= 0 && current !== previousTab) {
      setAnimation(current > previousTab ? "animate-slide-from-right" : "animate-slide-from-left");
    }
    previousTab = current;
  }, [pathname]);

  return (
    <div className={animation} onAnimationEnd={() => setAnimation("")}>
      {children}
    </div>
  );
}
