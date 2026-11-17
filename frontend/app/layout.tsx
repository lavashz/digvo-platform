import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digvo — wynajem maszyn budowlanych z operatorem i transportem",
  description:
    "Marketplace sprzętu budowlanego: maszyna, operator z uprawnieniami UDT i transport w jednej rezerwacji. Umowa PDF w 30 sekund.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
