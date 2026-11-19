import Link from "next/link";

export const metadata = { title: "Polityka prywatności" };

export default function PolitykaPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f5f5f7]">
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16 space-y-6">
        <Link href="/" className="text-sm text-brand hover:text-brand-soft">
          ← Digvo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Polityka prywatności</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Dokument demonstracyjny na potrzeby pracy inżynierskiej Digvo.
        </p>
        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Jakie dane przetwarzamy</h2>
          <p>
            W demo: adres e-mail, imię i nazwisko, telefon (przy rejestracji), dane rezerwacji
            (termin, maszyna, adres dostawy) oraz odczyty motogodzin w protokołach.
          </p>
          <h2 className="text-lg font-semibold text-white">2. Cel</h2>
          <p>
            Realizacja rezerwacji, autoryzacja JWT, generowanie umowy PDF oraz obsługa panelu
            dyspozytora/operatora.
          </p>
          <h2 className="text-lg font-semibold text-white">3. Przechowywanie</h2>
          <p>
            Dane trafiają do bazy PostgreSQL (Neon) poprzez API FastAPI (Render). Frontend działa
            na Vercel. Token sesji trzymany jest lokalnie w przeglądarce.
          </p>
          <h2 className="text-lg font-semibold text-white">4. Kontakt</h2>
          <p>
            W środowisku produkcyjnym należałoby podać dane administratora. Tutaj: projekt
            akademicki Digvo — bez komercyjnego administratora danych.
          </p>
        </section>
      </main>
    </div>
  );
}