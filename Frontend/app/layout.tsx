import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestion Escolar",
  description: "Sistema integral de gestión escolar para unidades educativas",
  generator: "Tarqui",
  icons: {
    icon: [
      {
        url: "/logoBuho.webp",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logoBuho.webp",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b2e" },
  ],
  width: "device-width",
  initialScale: 1,
};

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = GeistSans;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster closeButton richColors />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
