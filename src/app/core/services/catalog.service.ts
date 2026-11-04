import { Injectable, computed, inject, signal } from '@angular/core';

import type { Movie } from '../models';

import { MovieService } from './movie.service';
import type { TmdbFeed, TmdbGenre } from './tmdb.service';
import { TmdbService } from './tmdb.service';

export interface Rail {
  key: string;
  title: string;
  subtitle: string;
  movies: Movie[];
}

const FEEDS: { kind: TmdbFeed; title: string; subtitle: string }[] = [
  { kind: 'trending', title: 'Tendances', subtitle: 'Ce que tout le monde regarde cette semaine' },
  { kind: 'now_playing', title: "À l'affiche", subtitle: 'En salle en ce moment' },
  { kind: 'top_rated', title: 'Les incontournables', subtitle: 'Les mieux notés de tous les temps' },
  { kind: 'popular', title: 'Populaires', subtitle: 'Les films les plus consultés' },
  { kind: 'upcoming', title: 'Prochainement', subtitle: 'Bientôt sur grand écran' },
];

/**
 * Home catalogue = TMDB base (live feeds) + movies added by admins in Firestore.
 * Loaded once per session and shared by every page.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private tmdb = inject(TmdbService);
  private movies = inject(MovieService);

  readonly feeds = signal<Rail[]>([]);
  readonly genres = signal<TmdbGenre[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly rails = computed<Rail[]>(() => {
    const curated = this.movies.movies();
    const team: Rail[] = curated.length
      ? [{ key: 'team', title: 'Sélection CinéMatch', subtitle: "Ajoutés par l'équipe", movies: curated }]
      : [];
    return [...team, ...this.feeds()];
  });

  readonly spotlight = computed(() =>
    (this.feeds()[0]?.movies ?? []).filter((m) => m.backdropUrl && m.overview).slice(0, 6),
  );

  private started = false;

  async load(force = false): Promise<void> {
    if ((this.started && !force) || !this.tmdb.configured) {
      if (!this.tmdb.configured) this.error.set('Clé TMDB manquante dans app-config.ts');
      return;
    }
    this.started = true;
    this.loading.set(true);
    this.error.set('');
    try {
      const [genres, ...lists] = await Promise.all([
        this.tmdb.genreList(),
        ...FEEDS.map((f) => this.tmdb.feed(f.kind)),
      ]);
      this.genres.set(genres.sort((a, b) => a.name.localeCompare(b.name)));
      this.feeds.set(FEEDS.map((f, i) => ({ key: f.kind, title: f.title, subtitle: f.subtitle, movies: lists[i] })));
    } catch {
      this.started = false;
      this.error.set('Impossible de joindre TMDB. Vérifiez votre connexion.');
    } finally {
      this.loading.set(false);
    }
  }

  async byGenre(genreId: number): Promise<Movie[]> {
    const [a, b] = await Promise.all([this.tmdb.byGenre(genreId, 1), this.tmdb.byGenre(genreId, 2)]);
    return dedupe([...a, ...b]);
  }

  async search(query: string): Promise<Movie[]> {
    const q = normalize(query);
    const local = this.movies
      .movies()
      .filter(
        (m) =>
          normalize(m.title).includes(q) ||
          m.cast.some((a) => normalize(a).includes(q)) ||
          m.directors.some((d) => normalize(d).includes(q)),
      );
    const remote = await this.tmdb.searchMovies(query).catch(() => []);
    return dedupe([...local, ...remote]);
  }
}

function dedupe(list: Movie[]): Movie[] {
  const seen = new Set<string>();
  return list.filter((m) => !seen.has(m.id) && seen.add(m.id));
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
