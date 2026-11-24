import type { Machine, VendorInfo, SitePreset } from "./types";

export const VENDORS: Record<string, VendorInfo> = {
  KUJAWY: {
    id: "KUJAWY",
    name: "Kujawy Maszyny Sp. z o.o.",
    shortName: "Kujawy Maszyny",
    district: "Bydgoszcz • Fordon",
    rating: "4.9 ★",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  TERRARENT: {
    id: "TERRARENT",
    name: "TerraRent Bydgoszcz Sp. z o.o.",
    shortName: "TerraRent Bydgoszcz",
    district: "Bydgoszcz • ul. Przemysłowa",
    rating: "4.8 ★",
    badgeColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  BUDLIFT: {
    id: "BUDLIFT",
    name: "Budlift Białe Błota Sp. z o.o.",
    shortName: "Budlift Białe Błota",
    district: "Białe Błota k. Bydgoszczy",
    rating: "4.9 ★",
    badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
};

export function resolveMachineVendor(machine: Machine): VendorInfo {
  const org = (machine.organization_name || "").toLowerCase();
  if (org.includes("terrarent")) return VENDORS.TERRARENT;
  if (org.includes("budlift")) return VENDORS.BUDLIFT;
  if (org.includes("kujawy")) return VENDORS.KUJAWY;

  const n = machine.name.toLowerCase();
  if (n.includes("volvo") || n.includes("428f2") || n.includes("liebherr")) {
    return VENDORS.TERRARENT;
  }
  if (n.includes("kubota") || n.includes("manitou")) {
    return VENDORS.BUDLIFT;
  }
  return VENDORS.KUJAWY;
}

export const SITE_PRESETS: SitePreset[] = [
  {
    id: "fordon",
    label: "Bydgoszcz • Fordon",
    address: "ul. Fordońska 40, Bydgoszcz",
    lat: 53.1482,
    lng: 18.1705,
  },
  {
    id: "bppt",
    label: "Bydgoszcz • BPPT",
    address: "ul. Przemysłowa 24, Bydgoszcz",
    lat: 53.126,
    lng: 18.045,
  },
  {
    id: "torun",
    label: "Toruń • Wschodnia",
    address: "ul. Włocławska 167, Toruń",
    lat: 53.0138,
    lng: 18.5981,
  },
  {
    id: "inowroclaw",
    label: "Inowrocław • budowa",
    address: "ul. Dworcowa 12, Inowrocław",
    lat: 52.7957,
    lng: 18.2636,
  },
];

export const DEMO_ACCOUNTS = [
  { label: "Klient B2B: PW Lech Budownictwo (Bydgoszcz)", email: "zamowienia@pwlech-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: Ebud-Przemysłówka S.A. (BPPT)", email: "logistyka@ebud-bydgoszcz.pl", role: "CLIENT" },
  { label: "Klient B2B: KPPRD Inżynieria Drogowa", email: "sprzet@kpprd.pl", role: "CLIENT" },
  { label: "Klient B2B: Aqua-Instal Fordon", email: "biuro@aquainstal-fordon.pl", role: "CLIENT" },
  { label: "Klient: Tomasz Zieliński (Inwestor Fordon)", email: "inwestor@budowa-fordon.pl", role: "CLIENT" },
  { label: "Admin Digvo", email: "admin@digvo.pl", role: "ADMIN" },
  { label: "Dyspozytor Kujawy: Marek Wiśniewski", email: "dyspozytor@kujawy-maszyny.pl", role: "DISPATCHER" },
  { label: "Dyspozytor TerraRent: Ewa Jabłońska", email: "dyspozytor@terrarent-bydgoszcz.pl", role: "DISPATCHER" },
  { label: "Dyspozytor Budlift: Tomasz Maj", email: "dyspozytor@budlift.pl", role: "DISPATCHER" },
  { label: "Operator UDT: Jan Kowalski", email: "j.kowalski@kujawy-maszyny.pl", role: "OPERATOR" },
  { label: "Operator UDT: Piotr Nowak", email: "p.nowak@terrarent-bydgoszcz.pl", role: "OPERATOR" },
];

export function statusMeta(status: string) {
  switch (status) {
    case "CONFIRMED":
      return { label: "Potwierdzone", cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    case "IN_PROGRESS":
      return { label: "W trakcie pracy", cls: "bg-amber-500/10 text-amber-300 border border-amber-500/20" };
    case "COMPLETED":
      return { label: "Zakończone", cls: "bg-sky-500/10 text-sky-300 border border-sky-500/20" };
    case "CANCELLED":
      return { label: "Anulowane", cls: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    default:
      return { label: "Oczekujące", cls: "bg-white/[0.06] text-zinc-300 border border-white/[0.08]" };
  }
}

export function paymentMeta(status?: string) {
  switch (status) {
    case "TRANSFER_REPORTED":
      return {
        label: "Przelew zgłoszony",
        cls: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
      };
    case "DEPOSIT_CONFIRMED":
      return {
        label: "Kaucja opłacona",
        cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      };
    case "AWAITING_TRANSFER":
    default:
      return {
        label: "Do przelewu",
        cls: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
      };
  }
}

export const INPUT_CLS =
  "w-full bg-panel-2 border border-white/[0.1] focus:border-brand/70 hover:border-white/[0.18] outline-none px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 transition";