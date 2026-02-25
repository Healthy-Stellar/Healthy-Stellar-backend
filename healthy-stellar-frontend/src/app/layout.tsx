import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/context/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Healthy-Stellar | Decentralized Medical Records",
  description: "Secure, decentralized medical record management powered by the Stellar network.",
  icons: {
    icon: "/favicon.ico", // Ensure you add a favicon later
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            {/* Global Navigation or Progress Bars could go here */}
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}