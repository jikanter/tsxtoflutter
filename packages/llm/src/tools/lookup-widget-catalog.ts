import type { WidgetCatalogEntry } from '../system-prompt.js';

export interface CatalogHit {
  name: string;
  summary: string;
  adaptive?: string;
  /** 0..1 — higher is a better match. */
  score: number;
}

/**
 * Tiny ranked search over the closed widget catalog. The scoring intentionally
 * favours name matches over summary matches so the model can pull a widget by
 * remembering only part of its name. Pure function so tests can pin behaviour.
 */
export function lookupWidgetCatalog(
  query: string,
  catalog: readonly WidgetCatalogEntry[],
): CatalogHit[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length > 0);

  const hits: CatalogHit[] = [];
  for (const entry of catalog) {
    const name = entry.name.toLowerCase();
    const summary = entry.summary.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (name === tok) score += 1;
      else if (name.startsWith(tok)) score += 0.7;
      else if (name.includes(tok)) score += 0.5;
      if (summary.includes(tok)) score += 0.2;
    }
    if (score > 0) {
      const hit: CatalogHit = {
        name: entry.name,
        summary: entry.summary,
        score: Math.min(score, 1),
      };
      if (entry.adaptive !== undefined) hit.adaptive = entry.adaptive;
      hits.push(hit);
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 5);
}
