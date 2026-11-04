import { describe, expect, it } from 'vitest';

import { MATCH_THRESHOLD, buildProfile, compareProfiles, cosine, dice, eraSimilarity } from './matching';
import type { Movie } from './models';

const movie = (id: string, p: Partial<Movie>): Movie => ({
  id,
  title: id,
  overview: '',
  posterUrl: '',
  backdropUrl: '',
  year: 2000,
  genres: [],
  cast: [],
  directors: [],
  language: 'en',
  rating: 7,
  runtime: 120,
  source: 'admin',
  createdAt: 0,
  ...p,
});

const nolan = [
  movie('inception', {
    year: 2010,
    genres: ['Action', 'Science-Fiction'],
    cast: ['Leonardo DiCaprio', 'Tom Hardy'],
    directors: ['Christopher Nolan'],
  }),
  movie('interstellar', {
    year: 2014,
    genres: ['Aventure', 'Science-Fiction', 'Drame'],
    cast: ['Matthew McConaughey', 'Anne Hathaway'],
    directors: ['Christopher Nolan'],
  }),
  movie('dark-knight', {
    year: 2008,
    genres: ['Action', 'Crime', 'Drame'],
    cast: ['Christian Bale', 'Heath Ledger', 'Tom Hardy'],
    directors: ['Christopher Nolan'],
  }),
];
const scifi = [
  movie('inception', nolan[0]),
  movie('interstellar', nolan[1]),
  movie('tenet', {
    year: 2020,
    genres: ['Action', 'Science-Fiction'],
    cast: ['John David Washington'],
    directors: ['Christopher Nolan'],
  }),
];
const romcom = [
  movie('notting-hill', {
    year: 1999,
    genres: ['Romance', 'Comédie'],
    cast: ['Julia Roberts', 'Hugh Grant'],
    directors: ['Roger Michell'],
  }),
  movie('amelie', {
    year: 2001,
    genres: ['Romance', 'Comédie'],
    cast: ['Audrey Tautou'],
    directors: ['Jean-Pierre Jeunet'],
    language: 'fr',
  }),
  movie('love-actually', {
    year: 2003,
    genres: ['Romance', 'Comédie'],
    cast: ['Hugh Grant'],
    directors: ['Richard Curtis'],
  }),
];

describe('matching metrics', () => {
  it('cosine is 1 for identical vectors and 0 for disjoint ones', () => {
    expect(cosine(new Map([['a', 2]]), new Map([['a', 5]]))).toBeCloseTo(1);
    expect(cosine(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(0);
  });

  it('dice measures set overlap', () => {
    expect(dice(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(0.5);
  });

  it('era similarity rewards close release years', () => {
    expect(eraSimilarity([2010], [2011])).toBeGreaterThan(0.9);
    expect(eraSimilarity([1960], [2020])).toBeLessThan(0.01);
  });
});

describe('compareProfiles', () => {
  it('identical playlists score 100%', () => {
    expect(compareProfiles(buildProfile(nolan), buildProfile(nolan)).score).toBeCloseTo(1);
  });

  it('similar taste (not identical films) passes the 75% threshold', () => {
    const { score } = compareProfiles(buildProfile(nolan), buildProfile(scifi));
    expect(score).toBeGreaterThan(MATCH_THRESHOLD);
  });

  it('opposite taste stays far below the threshold', () => {
    const { score, facets } = compareProfiles(buildProfile(nolan), buildProfile(romcom));
    expect(score).toBeLessThan(0.3);
    expect(facets.find((f) => f.key === 'movies')!.score).toBe(0);
  });

  it('is symmetric', () => {
    const ab = compareProfiles(buildProfile(nolan), buildProfile(scifi)).score;
    const ba = compareProfiles(buildProfile(scifi), buildProfile(nolan)).score;
    expect(ab).toBeCloseTo(ba);
  });
});
