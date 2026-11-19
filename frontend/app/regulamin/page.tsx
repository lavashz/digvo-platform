import Link from "next/link";

export const metadata = { title: "Regulamin" };

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f5f5f7]">
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16 space-y-6">
        <Link href="/" className="text-sm text-brand hover:text-brand-soft">
          ← Digvo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Regulamin</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Niniejszy dokument ma charakter demonstracyjny i stanowi część pracy inżynierskiej
          platformy Digvo (marketplace krótkoterminowego wynajmu sprzętu budowlanego).
        </p>
        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Zakres usługi</h2>
          <p>
            Digvo umożliwia przeglądanie oferty maszyn, wycenę (maszyna / operator / transport)
            oraz złożenie rezerwacji zakończonej generowaniem umowy PDF.
          </p>
          <h2 className="text-lg font-semibold text-white">2. Konta i role</h2>
          <p>
            System rozróżnia role klienta, dyspozytora i operatora. Dostęp do panelu floty
            wymaga konta z odpowiednimi uprawnieniami.
          </p>
          <h2 className="text-lg font-semibold text-white">3. Rezerwacje</h2>
          <p>
            Rezerwacja jest wiążąca w ramach środowiska demo. Kolizje terminów są blokowane
            po stronie API i bazy danych. Anulowanie lub zmiana statusu leży po stronie dyspozytora.
          </p>
          <h2 className="text-lg font-semibold text-white">4. Odpowiedzialność</h2>
          <p>
            Platforma nie jest produkcyjnym systemem komercyjnym. Dane testowe, ceny i dostępność
            służą wyłącznie celom prezentacji i obrony pracy.
          </p>
        </section>
      </main>
    </div>
  );
}