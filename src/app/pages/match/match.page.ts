import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonRange,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDown, closeCircle, optionsOutline, peopleOutline, refreshOutline, searchOutline } from 'ionicons/icons';

import { MATCH_THRESHOLD, MIN_FAVORITES } from '../../core/matching';
import type { MatchFacet, MatchResult } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { MatchService } from '../../core/services/match.service';

type Scope = 'all' | 'name' | 'actor' | 'director' | 'movie' | 'genre';
type HitKind = Exclude<Scope, 'all'>;
type SortKey = 'score' | 'common' | 'favorites' | 'age' | 'name';

interface Hit {
  kind: HitKind;
  value: string;
  count: number;
}

interface Row {
  r: MatchResult;
  hits: Hit[];
}

interface Index {
  r: MatchResult;
  fields: Record<HitKind, { value: string; norm: string; count: number }[]>;
}

const HIT_LABEL: Record<HitKind, string> = {
  name: 'Nom',
  actor: 'Acteur',
  director: 'Réalisateur',
  movie: 'Film',
  genre: 'Genre',
};

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'name', label: 'Nom' },
  { key: 'actor', label: 'Acteur' },
  { key: 'director', label: 'Réalisateur' },
  { key: 'movie', label: 'Film' },
  { key: 'genre', label: 'Genre' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score', label: 'Compatibilité' },
  { key: 'common', label: 'Films en commun' },
  { key: 'favorites', label: 'Nb de favoris' },
  { key: 'age', label: 'Âge' },
  { key: 'name', label: 'Nom A→Z' },
];

const FACETS: { key: MatchFacet['key']; label: string }[] = [
  { key: 'genres', label: 'Genres' },
  { key: 'movies', label: 'Films' },
  { key: 'actors', label: 'Acteurs' },
  { key: 'era', label: 'Époque' },
  { key: 'directors', label: 'Réalisateurs' },
  { key: 'language', label: 'Langue' },
];

const STRONG_FACET = 0.5;

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function tally(values: string[]): { value: string; norm: string; count: number }[] {
  const map = new Map<string, { value: string; norm: string; count: number }>();
  for (const v of values) {
    if (!v) continue;
    const n = norm(v);
    const cur = map.get(n);
    if (cur) cur.count++;
    else map.set(n, { value: v, norm: n, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

@Component({
  selector: 'app-match',
  templateUrl: 'match.page.html',
  styleUrls: ['match.page.scss'],
  imports: [
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonSearchbar,
    IonRange,
  ],
})
export class MatchPage {
  private auth = inject(AuthService);
  private matchService = inject(MatchService);

  readonly matches = this.matchService.matches;
  readonly compared = this.matchService.comparedCount;
  readonly loading = this.matchService.loading;
  readonly error = this.matchService.error;
  readonly near = this.matchService.nearMatches;
  readonly threshold = Math.round(MATCH_THRESHOLD * 100);
  readonly minFavorites = MIN_FAVORITES;
  readonly myCount = computed(() => this.auth.profile()?.favorites.length ?? 0);
  readonly expanded = signal<string | null>(null);

  readonly scopes = SCOPES;
  readonly sorts = SORTS;
  readonly facetOptions = FACETS;
  readonly hitLabel = HIT_LABEL;

  readonly query = signal('');
  readonly scope = signal<Scope>('all');
  readonly sort = signal<SortKey>('score');
  readonly minScore = signal(this.threshold);
  /** null = full range (follows the data when matches change). */
  readonly ageRange = signal<{ lower: number; upper: number } | null>(null);
  readonly strongFacets = signal<MatchFacet['key'][]>([]);
  readonly filtersOpen = signal(false);

  readonly ageBounds = computed(() => {
    const ages = this.matches()
      .map((r) => r.user.age)
      .filter((a) => Number.isFinite(a) && a > 0);
    return ages.length ? { min: Math.min(...ages), max: Math.max(...ages) } : null;
  });

  readonly ageValue = computed(() => {
    const b = this.ageBounds();
    const r = this.ageRange();
    if (!b) return { lower: 0, upper: 0 };
    return r ? { lower: Math.max(b.min, r.lower), upper: Math.min(b.max, r.upper) } : { lower: b.min, upper: b.max };
  });

  readonly activeCount = computed(() => {
    let n = 0;
    if (this.query().trim()) n++;
    if (this.minScore() > this.threshold) n++;
    if (this.isAgeFiltered()) n++;
    n += this.strongFacets().length;
    return n;
  });

  private readonly index = computed<Index[]>(() =>
    this.matches().map((r) => {
      const movies = r.theirMovies?.length ? r.theirMovies : r.sharedMovies;
      return {
        r,
        fields: {
          name: tally([`${r.user.firstName} ${r.user.lastName}`]),
          actor: tally(movies.flatMap((m) => m.cast ?? [])),
          director: tally(movies.flatMap((m) => m.directors ?? [])),
          movie: tally(movies.map((m) => m.title)),
          genre: tally(movies.flatMap((m) => m.genres ?? [])),
        },
      };
    }),
  );

  readonly rows = computed<Row[]>(() => {
    const q = norm(this.query());
    const scope = this.scope();
    const min = this.minScore() / 100;
    const age = this.isAgeFiltered() ? this.ageValue() : null;
    const strong = this.strongFacets();

    const rows = this.index()
      .map<Row>((idx) => ({ r: idx.r, hits: q ? this.findHits(idx, q, scope) : [] }))
      .filter(({ r, hits }) => {
        if (q && !hits.length) return false;
        if (r.score < min) return false;
        if (age && (r.user.age < age.lower || r.user.age > age.upper)) return false;
        return strong.every((k) => (r.facets.find((f) => f.key === k)?.score ?? 0) >= STRONG_FACET);
      });

    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      score: (a, b) => b.r.score - a.r.score,
      common: (a, b) => b.r.sharedMovies.length - a.r.sharedMovies.length || b.r.score - a.r.score,
      favorites: (a, b) => b.r.user.favorites.length - a.r.user.favorites.length || b.r.score - a.r.score,
      age: (a, b) => a.r.user.age - b.r.user.age || b.r.score - a.r.score,
      name: (a, b) =>
        `${a.r.user.firstName} ${a.r.user.lastName}`.localeCompare(`${b.r.user.firstName} ${b.r.user.lastName}`, 'fr'),
    };
    return rows.sort(by[this.sort()]);
  });

  readonly suggestions = computed<{ kind: HitKind; value: string }[]>(() => {
    const q = norm(this.query());
    if (q.length < 2) return [];
    const scope = this.scope();
    const pool = new Map<string, { kind: HitKind; value: string; weight: number }>();
    for (const idx of this.index()) {
      for (const kind of Object.keys(idx.fields) as HitKind[]) {
        if (scope !== 'all' && scope !== kind) continue;
        for (const f of idx.fields[kind]) {
          if (!f.norm.includes(q) || f.norm === q) continue;
          const key = `${kind}:${f.norm}`;
          const cur = pool.get(key);
          const w = (f.norm.startsWith(q) ? 10 : 0) + 1;
          if (cur) cur.weight += w;
          else pool.set(key, { kind, value: f.value, weight: w });
        }
      }
    }
    return [...pool.values()].sort((a, b) => b.weight - a.weight).slice(0, 6);
  });

  constructor() {
    addIcons({ chevronDown, peopleOutline, optionsOutline, closeCircle, refreshOutline, searchOutline });
    // Recompute whenever my playlist changes (favourites carry their own details).
    effect(() => {
      const favorites = this.auth.profile()?.favorites;
      if (!favorites) return;
      untracked(() => void this.matchService.refresh());
    });
  }

  async onRefresh(ev: CustomEvent): Promise<void> {
    await this.matchService.refresh();
    (ev.target as HTMLIonRefresherElement).complete();
  }

  toggle(uid: string): void {
    this.expanded.update((cur) => (cur === uid ? null : uid));
  }

  onSearch(value: string | null | undefined): void {
    this.query.set(value ?? '');
  }

  pickSuggestion(s: { kind: HitKind; value: string }): void {
    this.scope.set(s.kind);
    this.query.set(s.value);
  }

  toggleFacet(key: MatchFacet['key']): void {
    this.strongFacets.update((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  }

  onMinScore(ev: CustomEvent): void {
    this.minScore.set(Number(ev.detail.value));
  }

  onAge(ev: CustomEvent): void {
    const v = ev.detail.value as { lower: number; upper: number };
    const b = this.ageBounds();
    this.ageRange.set(b && v.lower <= b.min && v.upper >= b.max ? null : v);
  }

  resetFilters(): void {
    this.query.set('');
    this.scope.set('all');
    this.sort.set('score');
    this.minScore.set(this.threshold);
    this.ageRange.set(null);
    this.strongFacets.set([]);
  }

  isAgeFiltered(): boolean {
    const b = this.ageBounds();
    const r = this.ageRange();
    return !!b && !!r && (r.lower > b.min || r.upper < b.max);
  }

  searchPlaceholder(): string {
    switch (this.scope()) {
      case 'name':
        return 'Rechercher un membre…';
      case 'actor':
        return 'Ex. Leonardo DiCaprio';
      case 'director':
        return 'Ex. Christopher Nolan';
      case 'movie':
        return 'Ex. Inception';
      case 'genre':
        return 'Ex. Science-Fiction';
      default:
        return 'Nom, acteur, réalisateur, film, genre…';
    }
  }

  topFacets(r: MatchResult): string {
    return [...r.facets]
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((f) => `${f.label} ${this.pct(f.score)}%`)
      .join(' · ');
  }

  pct(x: number): number {
    return Math.round(x * 100);
  }

  private findHits(idx: Index, q: string, scope: Scope): Hit[] {
    const kinds: HitKind[] = scope === 'all' ? ['name', 'actor', 'director', 'movie', 'genre'] : [scope];
    const hits: Hit[] = [];
    for (const kind of kinds) {
      for (const f of idx.fields[kind]) {
        if (f.norm.includes(q)) hits.push({ kind, value: f.value, count: f.count });
      }
    }
    return hits
      .sort((a, b) => {
        const ra = norm(a.value).startsWith(q) ? 0 : 1;
        const rb = norm(b.value).startsWith(q) ? 0 : 1;
        return ra - rb || b.count - a.count;
      })
      .slice(0, 3);
  }
}
