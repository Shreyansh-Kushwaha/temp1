import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AuthGate from "@/app/components/AuthGate";
import { ToastProvider } from "@/app/components/ToastProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PTM Agent — Super Sheldon",
  description: "Automated Parent-Teacher Meeting reports for Sheldon Labs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthGate>{children}</AuthGate>
        </ToastProvider>
      </body>
    </html>
  );
}
