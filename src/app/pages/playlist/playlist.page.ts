import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { heartDislikeOutline, sparklesOutline } from 'ionicons/icons';

import { PlaylistService } from '../../core/services/playlist.service';

function top(values: string[], n: number): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

@Component({
  selector: 'app-playlist',
  templateUrl: 'playlist.page.html',
  styleUrls: ['playlist.page.scss'],
  imports: [RouterLink, IonContent, IonButton, IonIcon],
})
export class PlaylistPage {
  private playlist = inject(PlaylistService);
  readonly items = this.playlist.items;

  readonly dna = computed(() => {
    const list = this.items();
    const years = list.map((m) => m.year).filter(Boolean);
    const avgYear = years.length ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : 0;
    const genres = top(
      list.flatMap((m) => m.genres),
      4,
    );
    const max = genres[0]?.count ?? 1;
    return {
      genres: genres.map((g) => ({ ...g, pct: Math.round((g.count / max) * 100) })),
      actors: top(
        list.flatMap((m) => m.cast.slice(0, 4)),
        4,
      ).map((a) => a.label),
      decade: avgYear ? `${Math.floor(avgYear / 10) * 10}s` : '—',
      hours: Math.floor(list.reduce((s, m) => s + m.runtime, 0) / 60),
    };
  });

  constructor() {
    addIcons({ heartDislikeOutline, sparklesOutline });
  }

  remove(id: string): void {
    void this.playlist.toggle(id);
  }
}
