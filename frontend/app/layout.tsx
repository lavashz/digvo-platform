import Providers from "./components/Providers";
import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const display = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://digvo-platform.vercel.app"),
  title: {
    default: "Digvo — wynajem maszyn z operatorem i transportem",
    template: "%s · Digvo",
  },
  description:
    "Marketplace sprzętu budowlanego: maszyna, operator UDT i transport w jednej rezerwacji. Umowa PDF w 30 sekund.",
  applicationName: "Digvo",
  keywords: ["wynajem maszyn", "koparka", "UDT", "Bydgoszcz", "Digvo"],
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "Digvo",
    title: "Digvo — maszyna, operator, transport",
    description:
      "Lokalni dostawcy, rezerwacja online, umowa PDF. Marketplace floty budowlanej.",
  },
  twitter: {
    card: "summary",
    title: "Digvo — wynajem maszyn budowlanych",
    description: "Maszyna + operator UDT + transport w jednej rezerwacji.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192.svg", type: "image/svg+xml", sizes: "192x192" },
    ],
    apple: [{ url: "/pwa-192.svg" }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Digvo",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`h-full antialiased ${display.variable} ${body.variable}`}>
      <body className="min-h-full flex flex-col font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}