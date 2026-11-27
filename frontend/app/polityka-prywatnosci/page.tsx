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
          Informacja o przetwarzaniu danych osobowych w serwisie Digvo.
        </p>
        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Jakie dane przetwarzamy</h2>
          <p>
            Adres e-mail, imię i nazwisko, telefon (przy rejestracji), NIP (dla dostawców),
            dane rezerwacji (termin, maszyna, adres dostawy) oraz odczyty motogodzin
            i dokumentacja protokołów zdawczo-odbiorczych.
          </p>
          <h2 className="text-lg font-semibold text-white">2. Cel</h2>
          <p>
            Realizacja rezerwacji, logowanie, generowanie umowy PDF, obsługa kaucji oraz
            panelu dyspozytora i operatora.
          </p>
          <h2 className="text-lg font-semibold text-white">3. Przechowywanie</h2>
          <p>
            Dane są przechowywane w zabezpieczonej bazie powiązanej z API Digvo. Token sesji
            jest trzymany lokalnie w przeglądarce użytkownika.
          </p>
          <h2 className="text-lg font-semibold text-white">4. Kontakt</h2>
          <p>
            W sprawach danych osobowych:{" "}
            <a href="mailto:kontakt@digvo.pl" className="text-brand hover:text-brand-soft">
              kontakt@digvo.pl
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}