import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { BrandIntroGate } from "@/components/brand/brand-intro-gate";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sodales Academy",
    template: "%s | Sodales Academy",
  },
  description:
    "SODALES is a modern creative intelligence collective where strategy, design & technology converge.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {/* Sibling of {children}, not nested inside it: everything below this
            point sits behind `app/loading.tsx`'s Suspense boundary, so an intro
            mounted in a nested layout only paints AFTER the ivory skeleton has
            already flashed. */}
        <BrandIntroGate />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
