import type { FavoriteMovie, MatchFacet } from './models';

/**
 * CinéMatch similarity engine.
 *
 * Two users are compared on their *taste profile*, not only on the exact movies
 * they share. Each facet yields a 0..1 score; the final score is a weighted sum.
 *
 *  facet       metric                                              weight
 *  ─────────   ──────────────────────────────────────────────────  ──────
 *  genres      cosine similarity of genre frequency vectors         0.30
 *  movies      Sørensen–Dice coefficient of favourite sets          0.20
 *  actors      cosine similarity of actor frequency vectors         0.20
 *  era         symmetric best-match Gaussian kernel on years        0.15
 *  directors   cosine similarity of director frequency vectors      0.075
 *  language    cosine similarity of original-language vectors       0.075
 *
 * Users are considered a match when the score is strictly above 75%.
 */
export const MATCH_THRESHOLD = 0.75;
/** Below this many favourites a profile is too thin to be compared reliably. */
export const MIN_FAVORITES = 3;

const WEIGHTS: Record<MatchFacet['key'], { weight: number; label: string }> = {
  genres: { weight: 0.3, label: 'Genres' },
  movies: { weight: 0.2, label: 'Films en commun' },
  actors: { weight: 0.2, label: 'Acteurs' },
  era: { weight: 0.15, label: 'Époque' },
  directors: { weight: 0.075, label: 'Réalisateurs' },
  language: { weight: 0.075, label: 'Langue' },
};

/** Years further apart than ~2σ barely count; σ = 6 years. */
const ERA_SIGMA = 6;

export interface TasteProfile {
  movieIds: Set<string>;
  genres: Map<string, number>;
  actors: Map<string, number>;
  directors: Map<string, number>;
  languages: Map<string, number>;
  years: number[];
}

export function buildProfile(movies: FavoriteMovie[]): TasteProfile {
  const p: TasteProfile = {
    movieIds: new Set(movies.map((m) => m.id)),
    genres: new Map(),
    actors: new Map(),
    directors: new Map(),
    languages: new Map(),
    years: movies.map((m) => m.year).filter((y) => y > 0),
  };
  for (const m of movies) {
    m.genres.forEach((g) => inc(p.genres, g));
    // Lead actors weigh more than supporting ones.
    m.cast.forEach((a, i) => inc(p.actors, a, i < 3 ? 1 : 0.5));
    m.directors.forEach((d) => inc(p.directors, d));
    if (m.language) inc(p.languages, m.language);
  }
  return p;
}

export function compareProfiles(a: TasteProfile, b: TasteProfile): { score: number; facets: MatchFacet[] } {
  const raw: Record<MatchFacet['key'], [number, string[]]> = {
    genres: [cosine(a.genres, b.genres), topShared(a.genres, b.genres)],
    movies: [dice(a.movieIds, b.movieIds), [...a.movieIds].filter((id) => b.movieIds.has(id))],
    actors: [cosine(a.actors, b.actors), topShared(a.actors, b.actors)],
    era: [eraSimilarity(a.years, b.years), eraLabels(a.years, b.years)],
    directors: [cosine(a.directors, b.directors), topShared(a.directors, b.directors)],
    language: [cosine(a.languages, b.languages), topShared(a.languages, b.languages)],
  };

  const facets = (Object.keys(WEIGHTS) as MatchFacet['key'][]).map<MatchFacet>((key) => ({
    key,
    label: WEIGHTS[key].label,
    weight: WEIGHTS[key].weight,
    score: clamp(raw[key][0]),
    shared: raw[key][1],
  }));
  const score = facets.reduce((s, f) => s + f.weight * f.score, 0);
  return { score: clamp(score), facets };
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  return dot / (norm(a) * norm(b));
}

export function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return (2 * common) / (a.size + b.size);
}

/**
 * For every year of A, how close is the nearest year of B (Gaussian kernel),
 * averaged in both directions so the measure is symmetric.
 */
export function eraSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const k = (d: number) => Math.exp(-((d / ERA_SIGMA) ** 2));
  const best = (xs: number[], ys: number[]) =>
    xs.reduce((s, x) => s + Math.max(...ys.map((y) => k(x - y))), 0) / xs.length;
  return (best(a, b) + best(b, a)) / 2;
}

function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function norm(m: Map<string, number>): number {
  let s = 0;
  for (const v of m.values()) s += v * v;
  return Math.sqrt(s);
}

function topShared(a: Map<string, number>, b: Map<string, number>, n = 5): string[] {
  return [...a.keys()]
    .filter((k) => b.has(k))
    .sort((x, y) => Math.min(b.get(y)!, a.get(y)!) - Math.min(b.get(x)!, a.get(x)!))
    .slice(0, n);
}

function eraLabels(a: number[], b: number[]): string[] {
  const decades = (ys: number[]) => new Set(ys.map((y) => `${Math.floor(y / 10) * 10}s`));
  const db = decades(b);
  return [...decades(a)].filter((d) => db.has(d)).sort();
}

function clamp(x: number): number {
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}
