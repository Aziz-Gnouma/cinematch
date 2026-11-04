import type { ElementRef } from '@angular/core';
import { Component, input, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward } from 'ionicons/icons';

import type { FavoriteMovie, Movie } from '../core/models';

import { PosterCardComponent } from './poster-card.component';

@Component({
  selector: 'app-movie-rail',
  imports: [PosterCardComponent, IonIcon],
  template: `
    <header class="head">
      <div>
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="arrows">
        <button (click)="scroll(-1)" aria-label="Précédent"><ion-icon name="chevron-back" /></button>
        <button (click)="scroll(1)" aria-label="Suivant"><ion-icon name="chevron-forward" /></button>
      </div>
    </header>
    <div class="track" #track>
      @for (m of movies(); track m.id) {
        <app-poster-card class="item" [movie]="m" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 34px;
    }
    .head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding: 0 var(--cm-gutter);
      margin-bottom: 14px;
    }
    h2 {
      margin: 0;
      font-family: var(--cm-font-display);
      font-weight: 400;
      font-size: 28px;
      line-height: 1;
    }
    p {
      margin: 5px 0 0;
      font-size: 13px;
      color: var(--cm-text-faint);
    }
    .arrows {
      display: none;
      gap: 8px;
    }
    .arrows button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      background: var(--cm-surface);
      color: var(--cm-text);
      border: 1px solid var(--cm-line);
      font-size: 18px;
      transition:
        background 0.2s,
        color 0.2s;
    }
    .arrows button:hover {
      background: var(--cm-amber);
      color: #1a1206;
    }
    @media (hover: hover) and (min-width: 768px) {
      .arrows {
        display: flex;
      }
    }
    .track {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: var(--rail-w, 138px);
      gap: 14px;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      scroll-padding: 0 var(--cm-gutter);
      padding: 6px var(--cm-gutter) 8px;
      scrollbar-width: none;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .item {
      scroll-snap-align: start;
    }
    @media (min-width: 768px) {
      .track {
        --rail-w: 168px;
        gap: 18px;
      }
    }
    @media (min-width: 1200px) {
      .track {
        --rail-w: 186px;
      }
    }
  `,
})
export class MovieRailComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly movies = input.required<(Movie | FavoriteMovie)[]>();
  private track = viewChild.required<ElementRef<HTMLElement>>('track');

  constructor() {
    addIcons({ chevronBack, chevronForward });
  }

  scroll(dir: 1 | -1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }
}
