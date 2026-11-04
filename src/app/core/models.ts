export type Role = 'user' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  /** Compressed JPEG data URL taken with the device camera (kept small, ~20-40 KB). */
  photo: string;
  role: Role;
  /** Admins disable accounts, they are never deleted. */
  disabled: boolean;
  /** Ordered list of movie ids (most recently added first). */
  favorites: string[];
  /**
   * Snapshot of each favourite (same order as `favorites`). Denormalised so the
   * playlist and the matching engine never depend on the shared catalogue.
   */
  favoriteMovies?: FavoriteMovie[];
  createdAt: number;
}

export interface Movie {
  id: string;
  tmdbId?: number;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  genres: string[];
  cast: string[];
  directors: string[];
  language: string;
  rating: number;
  runtime: number;
  source: 'tmdb' | 'admin';
  createdAt: number;
}

export type FavoriteMovie = Pick<
  Movie,
  'id' | 'title' | 'posterUrl' | 'year' | 'genres' | 'cast' | 'directors' | 'language' | 'rating' | 'runtime'
>;

export type MovieDraft = Omit<Movie, 'id' | 'createdAt' | 'source'>;

export interface MatchFacet {
  key: 'movies' | 'genres' | 'actors' | 'era' | 'directors' | 'language';
  label: string;
  weight: number;
  score: number;
  shared: string[];
}

export interface MatchResult {
  user: AppUser;
  score: number;
  facets: MatchFacet[];
  sharedMovies: FavoriteMovie[];
  theirMovies: FavoriteMovie[];
}
