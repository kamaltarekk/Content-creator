/**
 * Sørensen–Dice coefficient over character bigrams — a compact, dependency-free
 * string similarity in [0,1]. Used for conflict detection (comparing a proposed
 * value against an existing Client Brain value) and for fuzzy entity-name
 * matching when grouping repeatable items (cohorts, offers, …).
 */
function bigrams(value: string): Map<string, number> {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  const counts = new Map<string, number>();
  for (let i = 0; i < normalized.length - 1; i++) {
    const gram = normalized.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const [gram, count] of left) {
    const other = right.get(gram);
    if (other) intersection += Math.min(count, other);
  }

  const total = [...left.values()].reduce((s, n) => s + n, 0) + [...right.values()].reduce((s, n) => s + n, 0);
  return (2 * intersection) / total;
}
