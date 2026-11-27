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
          Regulamin korzystania z platformy Digvo — marketplace krótkoterminowego wynajmu
          maszyn budowlanych z operatorem i transportem (obszar Bydgoszcz i okolice).
        </p>
        <section className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Zakres usługi</h2>
          <p>
            Digvo umożliwia przeglądanie oferty wypożyczalni, wycenę (maszyna / operator /
            transport) oraz złożenie rezerwacji z umową PDF i obsługą kaucji.
          </p>
          <h2 className="text-lg font-semibold text-white">2. Konta i role</h2>
          <p>
            Dostępne są konta klienta oraz konta dostawców (dyspozytor / operator). Panel floty
            wymaga konta z uprawnieniami wypożyczalni.
          </p>
          <h2 className="text-lg font-semibold text-white">3. Rezerwacje i kaucja</h2>
          <p>
            Rezerwacja jest potwierdzana w systemie. Kolizje terminów są blokowane automatycznie.
            Status kaucji (do przelewu / zgłoszony / potwierdzony) widać w Moich rezerwacjach
            oraz w panelu dyspozytora. Anulowanie lub zmiana statusu zlecenia leży po stronie
            wypożyczalni.
          </p>
          <h2 className="text-lg font-semibold text-white">4. Odpowiedzialność</h2>
          <p>
            Digvo pośredniczy w rezerwacji między klientem a wypożyczalnią. Warunki najmu,
            kaucji i odpowiedzialności za sprzęt wynikają z umowy PDF oraz protokołu
            zdawczo-odbiorczego. Spory o uszkodzenia rozstrzygane są na podstawie protokołu
            z dokumentacją zdjęciową.
          </p>
          <h2 className="text-lg font-semibold text-white">5. Kontakt</h2>
          <p>
            Pytania o platformę:{" "}
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