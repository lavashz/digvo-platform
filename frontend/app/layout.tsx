import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`h-full antialiased ${display.variable} ${body.variable}`}>
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}