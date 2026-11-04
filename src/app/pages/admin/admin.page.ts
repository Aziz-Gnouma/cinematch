import type { OnDestroy } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonContent,
  IonIcon,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonToggle,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, checkmark, cloudDownloadOutline, createOutline } from 'ionicons/icons';

import type { AppUser } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { MovieService } from '../../core/services/movie.service';
import type { TmdbSearchHit } from '../../core/services/tmdb.service';
import { TmdbService } from '../../core/services/tmdb.service';
import { UserAdminService } from '../../core/services/user-admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  imports: [
    RouterLink,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonSearchbar,
    IonButton,
    IonIcon,
    IonSpinner,
    IonToggle,
  ],
})
export class AdminPage implements OnDestroy {
  private movies = inject(MovieService);
  private tmdb = inject(TmdbService);
  private userAdmin = inject(UserAdminService);
  private auth = inject(AuthService);
  private toast = inject(ToastController);
  private alert = inject(AlertController);

  readonly tab = signal<'movies' | 'users'>('movies');
  readonly tmdbReady = this.tmdb.configured;

  readonly catalogCount = computed(() => this.movies.movies().length);
  readonly hits = signal<TmdbSearchHit[]>([]);
  readonly searching = signal(false);
  readonly importing = signal<Set<number>>(new Set());
  readonly seedProgress = signal<string | null>(null);
  readonly inCatalog = computed(() => new Set(this.movies.movies().map((m) => m.tmdbId)));

  readonly userQuery = signal('');
  readonly users = computed(() => {
    const q = this.userQuery().toLowerCase();
    return this.userAdmin
      .users()
      .filter((u) => !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q));
  });
  readonly activeCount = computed(() => this.userAdmin.users().filter((u) => !u.disabled).length);
  readonly myUid = computed(() => this.auth.profile()?.uid);

  constructor() {
    addIcons({ add, checkmark, cloudDownloadOutline, createOutline });
    this.userAdmin.watch();
  }

  ngOnDestroy(): void {
    this.userAdmin.stop();
  }

  async search(q: string): Promise<void> {
    if (!q.trim()) {
      this.hits.set([]);
      return;
    }
    this.searching.set(true);
    try {
      this.hits.set(await this.tmdb.search(q));
    } catch {
      void this.notify('Recherche TMDB impossible — vérifiez la clé API.');
    } finally {
      this.searching.set(false);
    }
  }

  async import(hit: TmdbSearchHit): Promise<void> {
    this.importing.update((s) => new Set(s).add(hit.id));
    try {
      await this.movies.addFromTmdb(hit.id);
      void this.notify(`« ${hit.title} » ajouté au catalogue`);
    } catch {
      void this.notify("Échec de l'import.");
    } finally {
      this.importing.update((s) => {
        const n = new Set(s);
        n.delete(hit.id);
        return n;
      });
    }
  }

  async seed(): Promise<void> {
    this.seedProgress.set('Récupération des films populaires…');
    try {
      const added = await this.movies.seed(2, (done, total) => this.seedProgress.set(`Import ${done} / ${total}`));
      void this.notify(added ? `${added} films importés depuis TMDB` : 'Le catalogue est déjà à jour');
    } catch {
      void this.notify('Import impossible — vérifiez la clé TMDB.');
    } finally {
      this.seedProgress.set(null);
    }
  }

  async setDisabled(user: AppUser, disabled: boolean, toggle: HTMLIonToggleElement): Promise<void> {
    if (disabled) {
      const a = await this.alert.create({
        header: 'Désactiver ce compte ?',
        message: `${user.firstName} ${user.lastName} ne pourra plus se connecter. Ses données sont conservées et le compte peut être réactivé.`,
        buttons: [
          { text: 'Annuler', role: 'cancel' },
          { text: 'Désactiver', role: 'destructive' },
        ],
      });
      await a.present();
      const { role } = await a.onDidDismiss();
      if (role !== 'destructive') {
        toggle.checked = true;
        return;
      }
    }
    await this.userAdmin.setDisabled(user.uid, disabled);
    void this.notify(disabled ? 'Compte désactivé' : 'Compte réactivé');
  }

  private async notify(message: string) {
    const t = await this.toast.create({ message, duration: 2200, position: 'top', cssClass: 'cm-toast' });
    await t.present();
  }
}
