import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemedToaster } from "@/components/themed-toaster";

const nunitoSans = Nunito_Sans({ variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { saasMeta } from "@/lib/constants";

export const metadata: Metadata = {
  title: saasMeta.name,
  description: saasMeta.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunitoSans.variable} suppressHydrationWarning >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
          // enableSystem
          >
            <ThemedToaster />
            <AppLayout>
              {children}
            </AppLayout>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
