import type { Machine } from "./types";

const IMG = {
  catExcavator: "/machines/cat-excavator.jpg",
  catBackhoe: "/machines/cat-backhoe.jpg",
  jcbBackhoe: "/machines/jcb-backhoe.jpg",
  volvoLoader: "/machines/volvo-loader.jpg",
  liebherrWheeled: "/machines/liebherr.jpg",
  bobcatMini: "/machines/bobcat-mini.jpg",
  compactExcavator: "/machines/kubota-mini.jpg",
  telehandler: "/machines/telehandler.jpg",
  roller: "/machines/roller.jpg",
} as const;

const BY_NAME: Record<string, string> = {
  "Koparka gąsienicowa CAT 320 (20t)": IMG.catExcavator,
  "Koparkoładowarka JCB 3CX": IMG.jcbBackhoe,
  "Koparkoładowarka CAT 428F2": IMG.catBackhoe,
  "Ładowarka kołowa Volvo L60H": IMG.volvoLoader,
  "Koparka kołowa Liebherr A 914 Compact": IMG.liebherrWheeled,
  "Minikoparka Bobcat E27z (2.7t)": IMG.bobcatMini,
  "Minikoparka Kubota KX019-4 (1.9t)": IMG.compactExcavator,
  "Ładowarka teleskopowa Manitou MT 1440": IMG.telehandler,
};

const BY_CATEGORY: Record<string, string> = {
  "Koparki gąsienicowe": IMG.catExcavator,
  "Koparki kołowe": IMG.liebherrWheeled,
  Koparkoładowarki: IMG.jcbBackhoe,
  Minikoparki: IMG.bobcatMini,
  Ładowarki: IMG.volvoLoader,
  "Ładowarki kołowe": IMG.volvoLoader,
  "Ładowarki teleskopowe": IMG.telehandler,
  "Podnośniki teleskopowe": IMG.telehandler,
  Walce: IMG.roller,
};

export function machineImageUrl(
  machine: Pick<Machine, "name" | "category"> & { image_url?: string | null }
): string {
  if (machine.image_url) return machine.image_url;

  const byName = BY_NAME[machine.name];
  if (byName) return byName;

  const lower = machine.name.toLowerCase();
  if (lower.includes("liebherr") || lower.includes("914")) return IMG.liebherrWheeled;
  if (lower.includes("volvo") || lower.includes("l60")) return IMG.volvoLoader;
  if (lower.includes("428") || (lower.includes("cat") && lower.includes("koparko")))
    return IMG.catBackhoe;
  if (lower.includes("jcb") || lower.includes("3cx")) return IMG.jcbBackhoe;
  if (lower.includes("bobcat") || lower.includes("e27")) return IMG.bobcatMini;
  if (lower.includes("kubota") || lower.includes("kx019")) return IMG.compactExcavator;
  if (lower.includes("manitou") || lower.includes("teleskop")) return IMG.telehandler;
  if (lower.includes("320") || lower.includes("gąsienic")) return IMG.catExcavator;

  return BY_CATEGORY[machine.category] || IMG.catExcavator;
}

export { IMG };