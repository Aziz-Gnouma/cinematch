import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';

import { MovieService } from '../../core/services/movie.service';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

@Component({
  selector: 'app-new-movie',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonInput,
    IonTextarea,
    IonButton,
    IonSpinner,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/admin" text="" /></ion-buttons>
        <ion-title>Nouveau film</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form (ngSubmit)="save()" class="form">
        <div class="preview">
          @if (f.posterUrl) {
            <img [src]="f.posterUrl" alt="" />
          } @else {
            <span class="cm-display">{{ f.title || 'Titre' }}</span>
          }
        </div>

        @if (error()) {
          <div class="cm-error">{{ error() }}</div>
        }

        <label class="cm-field"><span>Titre *</span><ion-input name="title" [(ngModel)]="f.title" /></label>
        <div class="row">
          <label class="cm-field"
            ><span>Année *</span><ion-input type="number" name="year" [(ngModel)]="f.year"
          /></label>
          <label class="cm-field"
            ><span>Note /10</span><ion-input type="number" name="rating" [(ngModel)]="f.rating" step="0.1"
          /></label>
          <label class="cm-field"
            ><span>Durée (min)</span><ion-input type="number" name="runtime" [(ngModel)]="f.runtime"
          /></label>
        </div>
        <label class="cm-field"
          ><span>Genres * (séparés par des virgules)</span
          ><ion-input name="genres" [(ngModel)]="f.genres" placeholder="Drame, Thriller"
        /></label>
        <label class="cm-field"><span>Acteurs (virgules)</span><ion-input name="cast" [(ngModel)]="f.cast" /></label>
        <label class="cm-field"
          ><span>Réalisateur(s)</span><ion-input name="directors" [(ngModel)]="f.directors"
        /></label>
        <label class="cm-field"
          ><span>Langue originale (code)</span><ion-input name="language" [(ngModel)]="f.language" placeholder="fr"
        /></label>
        <label class="cm-field"
          ><span>URL de l'affiche</span><ion-input type="url" name="posterUrl" [(ngModel)]="f.posterUrl"
        /></label>
        <label class="cm-field"
          ><span>URL de l'image de fond</span><ion-input type="url" name="backdropUrl" [(ngModel)]="f.backdropUrl"
        /></label>
        <label class="cm-field"
          ><span>Synopsis</span><ion-textarea name="overview" [(ngModel)]="f.overview" [autoGrow]="true" rows="4"
        /></label>

        <ion-button class="cm-btn" expand="block" type="submit" [disabled]="saving()">
          @if (saving()) {
            <ion-spinner name="dots" />
          } @else {
            Ajouter au catalogue
          }
        </ion-button>
      </form>
    </ion-content>
  `,
  styles: `
    .form {
      max-width: 560px;
      margin: 0 auto;
      padding-bottom: 32px;
    }
    .preview {
      width: 140px;
      aspect-ratio: 2/3;
      margin: 6px auto 22px;
      border-radius: 14px;
      overflow: hidden;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 0;
      background: radial-gradient(circle at 30% 20%, #2a2233, var(--cm-surface));
      box-shadow: var(--cm-shadow);
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      span {
        font-size: 22px;
        color: var(--cm-amber);
        padding: 10px;
      }
    }
    .row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
  `,
})
export class NewMoviePage {
  private movies = inject(MovieService);
  private router = inject(Router);
  private toast = inject(ToastController);

  f = {
    title: '',
    year: new Date().getFullYear() as number | null,
    rating: 7 as number | null,
    runtime: 110 as number | null,
    genres: '',
    cast: '',
    directors: '',
    language: 'fr',
    posterUrl: '',
    backdropUrl: '',
    overview: '',
  };
  readonly saving = signal(false);
  readonly error = signal('');

  async save(): Promise<void> {
    const f = this.f;
    const year = Number(f.year);
    if (!f.title.trim() || !splitList(f.genres).length || year < 1888 || year > 2100) {
      this.error.set('Titre, année valide et au moins un genre sont requis.');
      return;
    }
    this.saving.set(true);
    try {
      const m = await this.movies.addManual({
        title: f.title.trim(),
        year,
        rating: Math.min(10, Math.max(0, Number(f.rating) || 0)),
        runtime: Number(f.runtime) || 0,
        genres: splitList(f.genres),
        cast: splitList(f.cast),
        directors: splitList(f.directors),
        language: f.language.trim().toLowerCase() || 'fr',
        posterUrl: f.posterUrl.trim(),
        backdropUrl: f.backdropUrl.trim(),
        overview: f.overview.trim(),
      });
      const t = await this.toast.create({
        message: `« ${m.title} » ajouté`,
        duration: 2000,
        position: 'top',
        cssClass: 'cm-toast',
      });
      await t.present();
      await this.router.navigate(['/movie', m.id], { replaceUrl: true });
    } catch {
      this.error.set("Échec de l'enregistrement (droits administrateur ?).");
    } finally {
      this.saving.set(false);
    }
  }
}
