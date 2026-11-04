import { Component, computed, effect, inject, input, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, globeOutline, heart, heartOutline, star, timeOutline } from 'ionicons/icons';

import type { Movie } from '../../core/models';
import { MovieService } from '../../core/services/movie.service';
import { PlaylistService } from '../../core/services/playlist.service';

@Component({
  selector: 'app-movie-detail',
  templateUrl: 'movie-detail.page.html',
  styleUrls: ['movie-detail.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonSkeletonText,
  ],
})
export class MovieDetailPage {
  private movies = inject(MovieService);
  private playlist = inject(PlaylistService);

  /** Bound from the `:id` route param (withComponentInputBinding). */
  readonly id = input.required<string>();
  readonly movie = signal<Movie | undefined>(undefined);
  readonly loading = signal(true);
  readonly isFav = computed(() => this.playlist.idSet().has(this.id()));
  readonly pending = computed(() => this.playlist.pending().has(this.id()));

  constructor() {
    addIcons({ calendarOutline, globeOutline, heart, heartOutline, star, timeOutline });
    effect(() => {
      const id = this.id();
      this.loading.set(true);
      void this.movies.resolve(id).then((m) => {
        if (id !== this.id()) return;
        this.movie.set(m);
        this.loading.set(false);
      });
    });
  }

  toggle(): void {
    void this.playlist.toggle(this.id());
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('');
  }

  runtime(min: number): string {
    return min ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : '—';
  }

  language(code: string): string {
    try {
      return new Intl.DisplayNames(['fr'], { type: 'language' }).of(code) ?? code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  }
}
