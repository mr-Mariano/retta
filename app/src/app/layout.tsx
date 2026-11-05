import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

// Plano 2 (2026-11-05): Inter for titles and body; 800 for titles.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Retta",
  description: "Encuentra una reta de fútbol e inscríbete solo.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} antialiased`}>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <DesktopSidebar />
        {children}
      </body>
    </html>
  );
}
