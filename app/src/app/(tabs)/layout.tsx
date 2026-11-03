import { BottomNav } from "@/components/bottom-nav";

/** Sections reached from the bottom nav; the nav stays put while pages change. */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
