import type { OnDestroy } from '@angular/core';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSkeletonText, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeCircle, heart, heartOutline, informationCircleOutline, search, star } from 'ionicons/icons';

import type { Movie } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { MovieRailComponent } from '../../shared/movie-rail.component';
import { PosterCardComponent } from '../../shared/poster-card.component';

const HERO_INTERVAL = 7000;

@Component({
  selector: 'app-discover',
  templateUrl: 'discover.page.html',
  styleUrls: ['discover.page.scss'],
  imports: [
    RouterLink,
    IonContent,
    IonIcon,
    IonButton,
    IonSkeletonText,
    IonSpinner,
    PosterCardComponent,
    MovieRailComponent,
  ],
})
export class DiscoverPage implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly catalog = inject(CatalogService);
  private playlist = inject(PlaylistService);

  readonly query = signal('');
  readonly genreId = signal<number | null>(null);
  readonly results = signal<Movie[]>([]);
  readonly searching = signal(false);
  readonly heroIndex = signal(0);
  readonly skeletonRails = [0, 1, 2];
  readonly skeletonCards = Array.from({ length: 8 }, (_, i) => i);

  readonly hero = computed(() => this.catalog.spotlight()[this.heroIndex()]);
  readonly heroIsFav = computed(() => !!this.hero() && this.playlist.idSet().has(this.hero()!.id));
  readonly heroPending = computed(() => !!this.hero() && this.playlist.pending().has(this.hero()!.id));
  readonly mode = computed<'browse' | 'search' | 'genre'>(() =>
    this.query().trim().length >= 2 ? 'search' : this.genreId() !== null ? 'genre' : 'browse',
  );
  readonly genreName = computed(() => this.catalog.genres().find((g) => g.id === this.genreId())?.name ?? '');

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 5 ? 'Séance de minuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  });

  private timer = setInterval(() => this.nextHero(), HERO_INTERVAL);
  private requestId = 0;

  constructor() {
    addIcons({ closeCircle, heart, heartOutline, informationCircleOutline, search, star });
    void this.catalog.load();

    // Search / genre results, ignoring stale responses.
    effect(() => {
      const mode = this.mode();
      const q = this.query().trim();
      const g = this.genreId();
      untracked(() => void this.fetchResults(mode, q, g));
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  onSearch(value: string): void {
    this.query.set(value);
  }

  pickGenre(id: number | null): void {
    this.query.set('');
    this.genreId.set(this.genreId() === id ? null : id);
  }

  goHero(i: number): void {
    this.heroIndex.set(i);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.nextHero(), HERO_INTERVAL);
  }

  toggleHeroFav(): void {
    const h = this.hero();
    if (h) void this.playlist.toggle(h.id);
  }

  retry(): void {
    void this.catalog.load(true);
  }

  private nextHero(): void {
    const n = this.catalog.spotlight().length;
    if (n) this.heroIndex.update((i) => (i + 1) % n);
  }

  private async fetchResults(mode: string, q: string, g: number | null): Promise<void> {
    if (mode === 'browse') {
      this.results.set([]);
      return;
    }
    const id = ++this.requestId;
    this.searching.set(true);
    await new Promise((r) => setTimeout(r, mode === 'search' ? 300 : 0)); // debounce typing
    if (id !== this.requestId) return;
    try {
      const list = mode === 'search' ? await this.catalog.search(q) : await this.catalog.byGenre(g!);
      if (id === this.requestId) this.results.set(list);
    } catch {
      if (id === this.requestId) this.results.set([]);
    } finally {
      if (id === this.requestId) this.searching.set(false);
    }
  }
}
