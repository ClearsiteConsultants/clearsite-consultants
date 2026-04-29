import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Clearsite Consultants | Web Development & AI Automation",
  description: "Custom web development, AI automation, and app development for small businesses. Affordable, expert solutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased pt-[65px]">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
