import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { heart, heartOutline, star } from 'ionicons/icons';

import type { FavoriteMovie, Movie } from '../core/models';
import { PlaylistService } from '../core/services/playlist.service';

@Component({
  selector: 'app-poster-card',
  imports: [DecimalPipe, RouterLink, IonIcon, IonSpinner],
  template: `
    <a class="card" [routerLink]="['/movie', movie().id]">
      <div class="poster">
        @if (movie().posterUrl) {
          <img [src]="movie().posterUrl" [alt]="movie().title" loading="lazy" />
        } @else {
          <div class="fallback">{{ movie().title }}</div>
        }
        <div class="veil"></div>
        @if (movie().rating) {
          <span class="rating"><ion-icon name="star" />{{ movie().rating | number: '1.1-1' }}</span>
        }
        <button
          class="fav"
          [class.on]="isFav()"
          (click)="toggle($event)"
          [attr.aria-label]="isFav() ? 'Retirer de ma playlist' : 'Ajouter à ma playlist'"
        >
          @if (isPending()) {
            <ion-spinner name="crescent" />
          } @else {
            <ion-icon [name]="isFav() ? 'heart' : 'heart-outline'" />
          }
        </button>
      </div>
      <h3>{{ movie().title }}</h3>
      <p>
        {{ movie().year || '—' }}
        @if (movie().genres.length) {
          · {{ movie().genres.slice(0, 2).join(', ') }}
        }
      </p>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: block;
      color: inherit;
      text-decoration: none;
      outline: none;
    }
    .poster {
      position: relative;
      aspect-ratio: 2 / 3;
      border-radius: 12px;
      overflow: hidden;
      background: var(--cm-surface);
      box-shadow:
        0 0 0 1px var(--cm-line),
        var(--cm-shadow);
      transition:
        transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1),
        box-shadow 0.35s;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .veil {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        rgba(10, 9, 13, 0.55) 0%,
        transparent 28%,
        transparent 60%,
        rgba(10, 9, 13, 0.7) 100%
      );
      opacity: 0.9;
      transition: opacity 0.3s;
    }
    @media (hover: hover) {
      .card:hover .poster,
      .card:focus-visible .poster {
        transform: translateY(-6px);
        box-shadow:
          0 0 0 1px rgba(245, 184, 65, 0.45),
          0 24px 40px -16px rgba(0, 0, 0, 0.95);
      }
      .card:hover img {
        transform: scale(1.05);
      }
    }
    .card:active .poster {
      transform: scale(0.97);
    }
    .fallback {
      height: 100%;
      display: grid;
      place-items: center;
      padding: 14px;
      text-align: center;
      font-family: var(--cm-font-display);
      font-size: 24px;
      color: var(--cm-amber);
      background: radial-gradient(circle at 30% 20%, #2a2233, var(--cm-surface));
    }
    .rating {
      position: absolute;
      left: 8px;
      top: 8px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(10, 9, 13, 0.7);
      backdrop-filter: blur(8px);
      font-size: 11px;
      font-weight: 800;
      color: var(--cm-amber);
    }
    .fav {
      position: absolute;
      right: 8px;
      bottom: 8px;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(10, 9, 13, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--cm-text);
      font-size: 18px;
      cursor: pointer;
      transition:
        transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1),
        background 0.2s;
    }
    .fav:hover {
      transform: scale(1.1);
    }
    .fav.on {
      background: var(--cm-red);
      border-color: transparent;
      color: #fff;
    }
    .fav ion-spinner {
      width: 18px;
      height: 18px;
      color: var(--cm-amber);
    }
    h3 {
      margin: 10px 2px 2px;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    p {
      margin: 0 2px;
      font-size: 12px;
      color: var(--cm-text-faint);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class PosterCardComponent {
  private playlist = inject(PlaylistService);
  private toast = inject(ToastController);

  readonly movie = input.required<Movie | FavoriteMovie>();
  readonly isFav = computed(() => this.playlist.idSet().has(this.movie().id));
  readonly isPending = computed(() => this.playlist.pending().has(this.movie().id));

  constructor() {
    addIcons({ heart, heartOutline, star });
  }

  async toggle(ev: Event): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();
    const title = this.movie().title;
    try {
      const added = await this.playlist.toggle(this.movie().id);
      await this.notify(added ? `« ${title} » ajouté à votre playlist` : `« ${title} » retiré`);
    } catch {
      await this.notify('Impossible de mettre à jour la playlist.');
    }
  }

  private async notify(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 1600, position: 'top', cssClass: 'cm-toast' });
    await t.present();
  }
}
