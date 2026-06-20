/**
 * fn (avanço por rotação) is no longer a single number per material.
 * Each material now has an `fn` field shaped like:
 *
 *   { mode: "table", table: { "2": 0.05, "3": 0.08, ... "20": 0.32 } }
 *
 * or, when the material borrows another material's curve scaled by a percentage:
 *
 *   { mode: "proportion", proportionOf: "SAE 1045", proportionPct: 100 }
 *
 * STANDARD_DIAMETERS is the fixed set of diameters (mm) used as table columns
 * across the whole app — admin panel editor, resolver, and calcAI consumption.
 */
export const STANDARD_DIAMETERS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20];

/** Builds an empty table with all standard diameters set to null. */
export function emptyFnTable() {
  return Object.fromEntries(STANDARD_DIAMETERS.map(d => [String(d), null]));
}

/** Type guard / normalizer — accepts legacy flat-number fn for backward compatibility. */
export function normalizeFn(fn) {
  if (fn == null) return { mode: "table", table: emptyFnTable() };
  if (typeof fn === "number") {
    // Legacy material: flat fn applied to every diameter
    return { mode: "table", table: Object.fromEntries(STANDARD_DIAMETERS.map(d => [String(d), fn])) };
  }
  if (fn.mode === "proportion") {
    return { mode: "proportion", proportionOf: fn.proportionOf ?? "", proportionPct: fn.proportionPct ?? 100 };
  }
  return { mode: "table", table: { ...emptyFnTable(), ...(fn.table ?? {}) } };
}

/**
 * Resolves the effective fn table for a material, following proportion
 * references until it lands on a table-mode material (or runs out of materials
 * to avoid infinite loops on circular references).
 */
export function resolveFnTable(materialName, materials, _seen = new Set()) {
  const mat = materials[materialName];
  if (!mat) return emptyFnTable();

  const fn = normalizeFn(mat.fn);
  if (fn.mode === "table") return fn.table;

  // proportion mode
  if (_seen.has(materialName)) return emptyFnTable(); // circular reference guard
  _seen.add(materialName);

  const refTable = resolveFnTable(fn.proportionOf, materials, _seen);
  const pct = Number(fn.proportionPct) || 100;
  const scaled = {};
  for (const d of STANDARD_DIAMETERS) {
    const v = refTable[String(d)];
    scaled[String(d)] = v == null ? null : Number((v * (pct / 100)).toFixed(4));
  }
  return scaled;
}

/**
 * Picks the fn value for a specific diameter, falling back to the nearest
 * defined diameter if the exact one isn't filled in.
 */
export function getFnForDiameter(materialName, materials, diameter) {
  const table = resolveFnTable(materialName, materials);
  const exact = table[String(diameter)];
  if (exact != null) return exact;

  // Fallback: nearest diameter with a defined value
  const defined = STANDARD_DIAMETERS
    .map(d => ({ d, v: table[String(d)] }))
    .filter(x => x.v != null);
  if (defined.length === 0) return 0;

  defined.sort((a, b) => Math.abs(a.d - diameter) - Math.abs(b.d - diameter));
  return defined[0].v;
}
