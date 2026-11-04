import { Injectable, computed, inject, signal } from '@angular/core';
import type { Unsubscribe } from 'firebase/firestore';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { Movie, MovieDraft } from '../models';

import { TmdbService } from './tmdb.service';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private tmdb = inject(TmdbService);

  readonly movies = signal<Movie[]>([]);
  readonly loaded = signal(false);
  readonly byId = computed(() => new Map(this.movies().map((m) => [m.id, m])));
  readonly genres = computed(() =>
    [...new Set(this.movies().flatMap((m) => m.genres))].sort((a, b) => a.localeCompare(b)),
  );

  private sub?: Unsubscribe;

  /** Starts listening once the user is authenticated (rules require it). */
  watch(): void {
    if (this.sub) return;
    this.sub = onSnapshot(collection(db, 'movies'), (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Movie), id: d.id }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      this.movies.set(list);
      this.loaded.set(true);
    });
  }

  stop(): void {
    this.sub?.();
    this.sub = undefined;
    this.movies.set([]);
    this.loaded.set(false);
  }

  private detailCache = new Map<string, Promise<Movie | undefined>>();

  /**
   * Full movie for any catalogue id: the admin catalogue first, otherwise the
   * TMDB base (`tmdb_{id}`) with cast & director, cached for the session.
   */
  resolve(id: string): Promise<Movie | undefined> {
    const local = this.byId().get(id);
    if (local) return Promise.resolve(local);
    const tmdbId = Number(id.replace(/^tmdb_/, ''));
    if (!id.startsWith('tmdb_') || !tmdbId) return Promise.resolve(undefined);
    let p = this.detailCache.get(id);
    if (!p) {
      p = this.tmdb.movie(tmdbId).catch(() => {
        this.detailCache.delete(id);
        return undefined;
      });
      this.detailCache.set(id, p);
    }
    return p;
  }

  /** TMDB movies get a deterministic id so re-importing never duplicates. */
  async addFromTmdb(tmdbId: number): Promise<Movie> {
    const draft = await this.tmdb.details(tmdbId);
    return this.save(`tmdb_${tmdbId}`, draft, 'tmdb');
  }

  async addManual(draft: MovieDraft): Promise<Movie> {
    const id = doc(collection(db, 'movies')).id;
    return this.save(id, draft, 'admin');
  }

  async seed(pages = 2, onProgress?: (done: number, total: number) => void): Promise<number> {
    const hits = new Map<number, true>();
    for (let p = 1; p <= pages; p++) {
      for (const h of [...(await this.tmdb.popular(p)), ...(await this.tmdb.topRated(p))]) {
        hits.set(h.id, true);
      }
    }
    const existing = this.byId();
    const todo = [...hits.keys()].filter((id) => !existing.has(`tmdb_${id}`));
    // Small batches keep us well under TMDB rate limits.
    for (let i = 0; i < todo.length; i += 6) {
      await Promise.all(todo.slice(i, i + 6).map((id) => this.addFromTmdb(id)));
      onProgress?.(Math.min(todo.length, i + 6), todo.length);
    }
    return todo.length;
  }

  private async save(id: string, draft: MovieDraft, source: Movie['source']): Promise<Movie> {
    const movie: Movie = { ...draft, id, source, createdAt: Date.now() };
    // Firestore rejects `undefined` values.
    if (movie.tmdbId === undefined) delete movie.tmdbId;
    await setDoc(doc(db, 'movies', id), movie);
    return movie;
  }
}
