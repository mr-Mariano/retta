import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// Big Shoulders with the optical-size axis: large sizes render as the Display cut.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Retta",
  description: "Encuentra una reta de fútbol e inscríbete solo.",
};

export const viewport: Viewport = {
  themeColor: "#181818",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geist.variable} ${bigShoulders.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
