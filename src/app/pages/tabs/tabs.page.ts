import { Component, inject } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { filmOutline, heartOutline, peopleOutline, personCircleOutline, shieldHalfOutline } from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="bar">
        <ion-tab-button tab="discover">
          <ion-icon name="film-outline" />
          <ion-label>Films</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="playlist">
          <ion-icon name="heart-outline" />
          <ion-label>Playlist</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="match">
          <ion-icon name="people-outline" />
          <ion-label>Match</ion-label>
        </ion-tab-button>
        @if (isAdmin()) {
          <ion-tab-button tab="admin">
            <ion-icon name="shield-half-outline" />
            <ion-label>Admin</ion-label>
          </ion-tab-button>
        }
        <ion-tab-button tab="profile">
          <ion-icon name="person-circle-outline" />
          <ion-label>Profil</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: `
    .bar {
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      height: calc(64px + env(safe-area-inset-bottom));
    }
    ion-tab-button {
      font-weight: 700;
      --ripple-color: transparent;
    }
    ion-tab-button ion-label {
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    ion-tab-button.tab-selected ion-icon {
      filter: drop-shadow(0 0 10px rgba(245, 184, 65, 0.6));
    }
  `,
})
export class TabsPage {
  readonly isAdmin = inject(AuthService).isAdmin;

  constructor() {
    addIcons({ filmOutline, heartOutline, peopleOutline, personCircleOutline, shieldHalfOutline });
  }
}
