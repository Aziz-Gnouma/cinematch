import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { Movie, MovieDraft } from '../models';

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

export interface TmdbSearchHit {
  id: number;
  title: string;
  year: number;
  posterUrl: string;
}

export type TmdbFeed = 'trending' | 'now_playing' | 'popular' | 'top_rated' | 'upcoming';

export interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbListItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  genre_ids: number[];
  original_language: string;
  vote_average: number;
}

interface TmdbDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genres: { id: number; name: string }[];
  original_language: string;
  vote_average: number;
  runtime: number;
  credits?: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
}

@Injectable({ providedIn: 'root' })
export class TmdbService {
  get configured(): boolean {
    const { apiKey, readAccessToken } = environment.tmdb;
    return !!readAccessToken || (!!apiKey && !apiKey.startsWith('YOUR_'));
  }

  private genreMap?: Promise<Map<number, string>>;

  async genreList(): Promise<TmdbGenre[]> {
    return [...(await this.genres()).entries()].map(([id, name]) => ({ id, name }));
  }

  /** Lightweight catalogue rows (no cast yet — fetched on demand by `movie()`). */
  async feed(kind: TmdbFeed, page = 1): Promise<Movie[]> {
    // TMDB's own /top_rated is skewed by recent films with few votes:
    // real classics = best average among widely rated movies.
    if (kind === 'top_rated') {
      const res = await this.get<{ results: TmdbListItem[] }>('/discover/movie', {
        sort_by: 'vote_average.desc',
        'vote_count.gte': '5000',
        page: String(page),
      });
      return this.toMovies(res.results);
    }
    const path = kind === 'trending' ? '/trending/movie/week' : `/movie/${kind}`;
    const res = await this.get<{ results: TmdbListItem[] }>(path, { page: String(page), region: 'FR' });
    return this.toMovies(res.results);
  }

  async byGenre(genreId: number, page = 1): Promise<Movie[]> {
    const res = await this.get<{ results: TmdbListItem[] }>('/discover/movie', {
      with_genres: String(genreId),
      sort_by: 'popularity.desc',
      'vote_count.gte': '150',
      page: String(page),
    });
    return this.toMovies(res.results);
  }

  async searchMovies(query: string): Promise<Movie[]> {
    if (!query.trim()) return [];
    const res = await this.get<{ results: TmdbListItem[] }>('/search/movie', { query });
    return this.toMovies(res.results);
  }

  async movie(tmdbId: number): Promise<Movie> {
    return { ...(await this.details(tmdbId)), id: `tmdb_${tmdbId}`, source: 'tmdb', createdAt: 0 };
  }

  async popular(page = 1): Promise<TmdbSearchHit[]> {
    const res = await this.get<{ results: any[] }>('/movie/popular', { page: String(page) });
    return res.results.map(toHit);
  }

  async topRated(page = 1): Promise<TmdbSearchHit[]> {
    const res = await this.get<{ results: any[] }>('/movie/top_rated', { page: String(page) });
    return res.results.map(toHit);
  }

  async search(query: string): Promise<TmdbSearchHit[]> {
    if (!query.trim()) return [];
    const res = await this.get<{ results: any[] }>('/search/movie', { query });
    return res.results.map(toHit);
  }

  async details(tmdbId: number): Promise<MovieDraft> {
    const d = await this.get<TmdbDetails>(`/movie/${tmdbId}`, { append_to_response: 'credits' });
    return {
      tmdbId: d.id,
      title: d.title,
      overview: d.overview ?? '',
      posterUrl: d.poster_path ? `${IMG}/w500${d.poster_path}` : '',
      backdropUrl: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : '',
      year: d.release_date ? Number(d.release_date.slice(0, 4)) : 0,
      genres: d.genres.map((g) => g.name),
      cast: (d.credits?.cast ?? [])
        .sort((a, b) => a.order - b.order)
        .slice(0, 8)
        .map((c) => c.name),
      directors: (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name),
      language: d.original_language,
      rating: Math.round(d.vote_average * 10) / 10,
      runtime: d.runtime ?? 0,
    };
  }

  private genres(): Promise<Map<number, string>> {
    this.genreMap ??= this.get<{ genres: TmdbGenre[] }>('/genre/movie/list').then(
      (r) => new Map(r.genres.map((g) => [g.id, g.name])),
    );
    return this.genreMap;
  }

  private async toMovies(items: TmdbListItem[]): Promise<Movie[]> {
    const genres = await this.genres();
    return items
      .filter((r) => r.poster_path)
      .map((r) => ({
        id: `tmdb_${r.id}`,
        tmdbId: r.id,
        title: r.title,
        overview: r.overview ?? '',
        posterUrl: `${IMG}/w342${r.poster_path}`,
        backdropUrl: r.backdrop_path ? `${IMG}/w1280${r.backdrop_path}` : '',
        year: r.release_date ? Number(r.release_date.slice(0, 4)) : 0,
        genres: r.genre_ids.map((id) => genres.get(id)).filter((g): g is string => !!g),
        cast: [],
        directors: [],
        language: r.original_language,
        rating: Math.round(r.vote_average * 10) / 10,
        runtime: 0,
        source: 'tmdb',
        createdAt: 0,
      }));
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const { apiKey, readAccessToken, language } = environment.tmdb;
    const url = new URL(API + path);
    url.searchParams.set('language', language);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (readAccessToken) headers['Authorization'] = `Bearer ${readAccessToken}`;
    else url.searchParams.set('api_key', apiKey);

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json() as Promise<T>;
  }
}

function toHit(r: any): TmdbSearchHit {
  return {
    id: r.id,
    title: r.title,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : 0,
    posterUrl: r.poster_path ? `${IMG}/w342${r.poster_path}` : '',
  };
}
