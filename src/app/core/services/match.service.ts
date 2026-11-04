import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../firebase';
import { MATCH_THRESHOLD, MIN_FAVORITES, buildProfile, compareProfiles } from '../matching';
import type { AppUser, FavoriteMovie, MatchResult } from '../models';

import { AuthService } from './auth.service';
import { MovieService } from './movie.service';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private auth = inject(AuthService);
  private movies = inject(MovieService);

  readonly matches = signal<MatchResult[]>([]);
  readonly comparedCount = signal(0);
  readonly nearMatches = signal<MatchResult[]>([]);
  readonly loading = signal(false);

  readonly error = signal('');
  private run = 0;

  async refresh(): Promise<void> {
    const me = this.auth.profile();
    if (!me) return;
    const run = ++this.run;
    this.loading.set(true);
    this.error.set('');
    try {
      const mine = await this.favoritesOf(me);
      if (mine.length < MIN_FAVORITES) {
        if (run === this.run) {
          this.matches.set([]);
          this.nearMatches.set([]);
          this.comparedCount.set(0);
        }
        return;
      }
      const myProfile = buildProfile(mine);

      const snap = await getDocs(query(collection(db, 'users'), where('disabled', '==', false)));
      const others = await Promise.all(
        snap.docs
          .map((d) => d.data() as AppUser)
          .filter((u) => u.uid !== me.uid)
          .map(async (user) => ({ user, theirs: await this.favoritesOf(user) })),
      );
      const results: MatchResult[] = others
        .filter(({ theirs }) => theirs.length >= MIN_FAVORITES)
        .map(({ user, theirs }) => {
          const { score, facets } = compareProfiles(myProfile, buildProfile(theirs));
          const sharedIds = new Set(facets.find((f) => f.key === 'movies')!.shared);
          return { user, score, facets, sharedMovies: mine.filter((m) => sharedIds.has(m.id)), theirMovies: theirs };
        });

      if (run !== this.run) return;
      this.comparedCount.set(results.length);
      results.sort((a, b) => b.score - a.score);
      this.matches.set(results.filter((r) => r.score > MATCH_THRESHOLD));
      this.nearMatches.set(results.filter((r) => r.score <= MATCH_THRESHOLD).slice(0, 3));
    } catch (e) {
      console.error('[CinéMatch] matching failed', e);
      if (run === this.run) this.error.set('Impossible de calculer les correspondances.');
    } finally {
      if (run === this.run) this.loading.set(false);
    }
  }

  /**
   * Favourite details for any profile: stored snapshots first, then the admin
   * catalogue, then TMDB (cached by MovieService).
   */
  private async favoritesOf(user: AppUser): Promise<FavoriteMovie[]> {
    const snapshots = new Map((user.favoriteMovies ?? []).map((m) => [m.id, m]));
    const list = await Promise.all(
      (user.favorites ?? []).map(
        async (id): Promise<FavoriteMovie | undefined> => snapshots.get(id) ?? this.movies.resolve(id),
      ),
    );
    return list.flatMap((m) => (m ? [m] : []));
  }
}
