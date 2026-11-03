import type { Metadata, Viewport } from "next";
import { Alegreya_Sans } from "next/font/google";
import "./globals.css";

// One family for titles and body (session 7); 500 for titles, 700 stands in for 600.
const alegreyaSans = Alegreya_Sans({
  variable: "--font-alegreya-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Retta",
  description: "Encuentra una reta de fútbol e inscríbete solo.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${alegreyaSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
