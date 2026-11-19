import type { Machine } from "./types";

const LOCAL = {
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

const REMOTE = {
  catExcavator:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Caterpillar_330_excavator_on_a_pile_of_dirt.jpg/1280px-Caterpillar_330_excavator_on_a_pile_of_dirt.jpg",
  catBackhoe:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Caterpillar_backhoe_loader_at_construction_site_in_Sunnyvale%2C_back_view.jpg/1280px-Caterpillar_backhoe_loader_at_construction_site_in_Sunnyvale%2C_back_view.jpg",
  jcbBackhoe:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Koparko-ladowarka.jpg/1280px-Koparko-ladowarka.jpg",
  volvoLoader:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Volvo_L90G_loader_at_a_job_site_in_a_Palo_Alto.jpg/1280px-Volvo_L90G_loader_at_a_job_site_in_a_Palo_Alto.jpg",
  liebherrWheeled:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Bauma_2007_Excavator_Liebherr_2.jpg/1280px-Bauma_2007_Excavator_Liebherr_2.jpg",
  bobcatMini:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Bobcat_E50_mini_excavator_with_oversized_treads.jpg/1280px-Bobcat_E50_mini_excavator_with_oversized_treads.jpg",
  compactExcavator:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/JCB_compact_excavator%2C_2013.JPG/1280px-JCB_compact_excavator%2C_2013.JPG",
  telehandler:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Telehandler_transporting_whisky_barrels.jpg/1280px-Telehandler_transporting_whisky_barrels.jpg",
  roller:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Caterpillar_CB54B_roller_on_dirt_lot_in_Campbell.jpg/1280px-Caterpillar_CB54B_roller_on_dirt_lot_in_Campbell.jpg",
} as const;

/** Prefer local file; browser will 404→broken if missing — use known-local set */
const KNOWN_LOCAL = new Set([
  "cat-excavator.jpg",
  "cat-backhoe.jpg",
  "volvo-loader.jpg",
  "telehandler.jpg",
  "jcb-backhoe.jpg",
  "liebherr.jpg",
  "bobcat-mini.jpg",
  "kubota-mini.jpg",
  "roller.jpg",
]);

function pick(key: keyof typeof LOCAL): string {
  const file = LOCAL[key].replace("/machines/", "");
  return KNOWN_LOCAL.has(file) ? LOCAL[key] : REMOTE[key];
}

const IMG = {
  catExcavator: pick("catExcavator"),
  catBackhoe: pick("catBackhoe"),
  jcbBackhoe: pick("jcbBackhoe"),
  volvoLoader: pick("volvoLoader"),
  liebherrWheeled: pick("liebherrWheeled"),
  bobcatMini: pick("bobcatMini"),
  compactExcavator: pick("compactExcavator"),
  telehandler: pick("telehandler"),
  roller: pick("roller"),
};

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

export function machineImageUrl(machine: Pick<Machine, "name" | "category">): string {
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

export { LOCAL, REMOTE };