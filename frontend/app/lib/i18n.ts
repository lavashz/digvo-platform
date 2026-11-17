export type Locale = "pl" | "en";
export type Currency = "PLN" | "EUR";

const dict = {
  pl: {
    marketplace: "Marketplace",
    dispatcher: "Dyspozytor",
    operator: "Operator",
    login: "Zaloguj się",
    logout: "Wyloguj",
    heroTitle1: "Maszyna. Operator. Transport.",
    heroTitle2: "Jedna rezerwacja.",
    heroSub:
      "Marketplace floty budowlanej: lokalni dostawcy udostępniają maszyny, a Ty rezerwujesz sprzęt z operatorem UDT i transportem — umowa PDF w 30 sekund.",
    browse: "Przeglądaj sprzęt",
    myBookings: "Moje rezerwacje",
    machinesInDb: "Maszyn w bazie",
    vendorsOnMarket: "Dostawców na marketplace",
    udtReviews: "Przeglądy UDT",
    catalog: "Katalog sprzętu",
    allVendors: "Wszystkie wypożyczalnie",
    configurator: "Konfigurator zamówienia",
    withOperator: "Operator z uprawnieniami UDT",
    withOperatorSub: "Certyfikowany operator z bazy dostawcy",
    withTransport: "Transport niskopodwoziowy",
    withTransportSub: "Dostawa na budowę i odbiór sprzętu",
    siteLocation: "Lokalizacja placu budowy",
    sitePreset: "Wybierz plac budowy",
    mapCaption: "Mapa: baza dostawcy → plac budowy (OpenStreetMap)",
    transportBuffer: "Bufor logistyczny lawety (jedna strona)",
    machineRent: "Wynajem maszyny",
    operatorFee: "Obsługa operatorska",
    logistics: "Logistyka (w obie strony)",
    netTotal: "Suma netto",
    grossTotal: "Suma brutto (z 23% VAT)",
    deposit: "Zwrotna kaucja zabezpieczająca",
    quoting: "Przeliczanie wyceny z serwera…",
    distanceOneWay: "Dystans (jedna strona, z bazy dostawcy)",
    bookCta: "Zarezerwuj i wygeneruj umowę",
    loginToBook: "Zaloguj się, aby zarezerwować",
    occupied: "Termin zajęty — sprawdź inny dzień",
    day: "doba",
    hoursShort: "h",
    assignedOperator: "Przypisany operator (algorytm punktacji)",
    operatorScore: "Punktacja",
    operatorWeekLoad: "Obciążenie w tygodniu",
  },
  en: {
    marketplace: "Marketplace",
    dispatcher: "Dispatcher",
    operator: "Operator",
    login: "Sign in",
    logout: "Sign out",
    heroTitle1: "Machine. Operator. Transport.",
    heroTitle2: "One booking.",
    heroSub:
      "Construction fleet marketplace: local vendors list machines, you book equipment with a certified operator and transport — PDF contract in 30 seconds.",
    browse: "Browse equipment",
    myBookings: "My bookings",
    machinesInDb: "Machines listed",
    vendorsOnMarket: "Vendors on marketplace",
    udtReviews: "UDT inspections",
    catalog: "Equipment catalog",
    allVendors: "All rental companies",
    configurator: "Order configurator",
    withOperator: "Operator with UDT license",
    withOperatorSub: "Certified operator from the vendor pool",
    withTransport: "Low-loader transport",
    withTransportSub: "Delivery to site and equipment pickup",
    siteLocation: "Construction site location",
    sitePreset: "Choose construction site",
    mapCaption: "Map: vendor base → job site (OpenStreetMap)",
    transportBuffer: "Transport logistics buffer (one way)",
    machineRent: "Machine rental",
    operatorFee: "Operator service",
    logistics: "Logistics (round trip)",
    netTotal: "Net total",
    grossTotal: "Gross total (23% VAT)",
    deposit: "Refundable security deposit",
    quoting: "Recalculating quote from server…",
    distanceOneWay: "One-way distance from vendor base",
    bookCta: "Book and generate contract",
    loginToBook: "Sign in to book",
    occupied: "Slot taken — try another day",
    day: "day",
    hoursShort: "h",
    assignedOperator: "Assigned operator (scoring algorithm)",
    operatorScore: "Score",
    operatorWeekLoad: "Weekly load",
  },
} as const;

export type TranslationKey = keyof typeof dict.pl;

export function t(locale: Locale, key: TranslationKey): string {
  return dict[locale][key] ?? dict.pl[key];
}

export function formatMoney(amountPln: number, currency: Currency, eurRate: number): string {
  const value = currency === "EUR" ? amountPln / eurRate : amountPln;
  return new Intl.NumberFormat(currency === "EUR" ? "en-EU" : "pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}