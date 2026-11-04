import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { doc, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { FavoriteMovie, Movie } from '../models';

import { AuthService } from './auth.service';
import { MovieService } from './movie.service';

export function toFavorite(m: Movie | FavoriteMovie): FavoriteMovie {
  return {
    id: m.id,
    title: m.title,
    posterUrl: m.posterUrl,
    year: m.year,
    genres: m.genres,
    cast: m.cast.slice(0, 8),
    directors: m.directors,
    language: m.language,
    rating: m.rating,
    runtime: m.runtime,
  };
}

/**
 * The user's personal playlist, stored on the profile:
 * `favorites` (ordered ids, source of truth) + `favoriteMovies` (snapshots).
 * When the deployed rules don't accept snapshots yet, only ids are saved and
 * details are resolved from the catalogue / TMDB instead.
 */
@Injectable({ providedIn: 'root' })
export class PlaylistService {
  private auth = inject(AuthService);
  private movies = inject(MovieService);

  readonly ids = computed(() => this.auth.profile()?.favorites ?? []);
  readonly idSet = computed(() => new Set(this.ids()));
  readonly pending = signal<ReadonlySet<string>>(new Set());
  private resolved = signal<ReadonlyMap<string, FavoriteMovie>>(new Map());
  private snapshotsAllowed = true;

  readonly items = computed<FavoriteMovie[]>(() => {
    const profile = this.auth.profile();
    if (!profile) return [];
    const snapshots = new Map((profile.favoriteMovies ?? []).map((m) => [m.id, m]));
    const catalogue = this.movies.byId();
    const resolved = this.resolved();
    return profile.favorites.flatMap((id) => {
      const m: FavoriteMovie | undefined = snapshots.get(id) ?? catalogue.get(id) ?? resolved.get(id);
      return m ? [m] : [];
    });
  });

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (!profile) return;
      const known = new Set((profile.favoriteMovies ?? []).map((m) => m.id));
      const missing = profile.favorites.filter(
        (id) => !known.has(id) && !this.movies.byId().has(id) && !untracked(this.resolved).has(id),
      );
      for (const id of missing) {
        void this.movies.resolve(id).then((m) => {
          if (m) this.resolved.update((map) => new Map(map).set(id, toFavorite(m)));
        });
      }
    });
  }

  has(id: string): boolean {
    return this.idSet().has(id);
  }

  async toggle(movieId: string): Promise<boolean> {
    const profile = this.auth.profile();
    if (!profile || this.pending().has(movieId)) return this.has(movieId);
    this.setPending(movieId, true);
    try {
      const removing = this.has(movieId);
      const snapshots = new Map(this.items().map((m) => [m.id, m]));

      if (!removing) {
        // Cast & director are required by the matching engine: fetch full details.
        const movie = await this.movies.resolve(movieId);
        if (!movie) throw new Error(`Film introuvable : ${movieId}`);
        const fav = toFavorite(movie);
        snapshots.set(movieId, fav);
        this.resolved.update((map) => new Map(map).set(movieId, fav));
      }

      const ids = removing
        ? profile.favorites.filter((id) => id !== movieId)
        : [movieId, ...profile.favorites.filter((id) => id !== movieId)];
      const favoriteMovies = ids.flatMap((id) => (snapshots.has(id) ? [snapshots.get(id)!] : []));
      await this.save(profile.uid, ids, favoriteMovies);
      return !removing;
    } finally {
      this.setPending(movieId, false);
    }
  }

  private async save(uid: string, favorites: string[], favoriteMovies: FavoriteMovie[]): Promise<void> {
    const ref = doc(db, 'users', uid);
    if (this.snapshotsAllowed) {
      try {
        await updateDoc(ref, { favorites, favoriteMovies });
        return;
      } catch (e) {
        if ((e as { code?: string }).code !== 'permission-denied') throw e;
        // Older security rules: fall back to ids only (details resolved on read).
        this.snapshotsAllowed = false;
        console.warn('[CinéMatch] firestore.rules not up to date: saving favourite ids only.');
      }
    }
    await updateDoc(ref, { favorites });
  }

  private setPending(id: string, on: boolean): void {
    this.pending.update((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }
}
