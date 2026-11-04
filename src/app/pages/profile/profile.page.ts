import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { doc, updateDoc } from 'firebase/firestore';
import { addIcons } from 'ionicons';
import { camera, logOutOutline, shieldCheckmark } from 'ionicons/icons';

import { db } from '../../core/firebase';
import { AuthService } from '../../core/services/auth.service';
import { CameraService } from '../../core/services/camera.service';
import { PlaylistService } from '../../core/services/playlist.service';

@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  imports: [DatePipe, UpperCasePipe, IonContent, IonButton, IonIcon, IonSpinner],
})
export class ProfilePage {
  private auth = inject(AuthService);
  private camera = inject(CameraService);
  private playlist = inject(PlaylistService);

  readonly me = this.auth.profile;
  readonly saving = signal(false);
  readonly stats = computed(() => {
    const items = this.playlist.items();
    return {
      films: items.length,
      genres: new Set(items.flatMap((m) => m.genres)).size,
      actors: new Set(items.flatMap((m) => m.cast)).size,
    };
  });

  constructor() {
    addIcons({ camera, logOutOutline, shieldCheckmark });
  }

  async retakePhoto(): Promise<void> {
    const me = this.me();
    if (!me) return;
    try {
      const photo = await this.camera.takeSelfie();
      this.saving.set(true);
      await updateDoc(doc(db, 'users', me.uid), { photo });
    } catch {
      // Cancelled by the user — nothing to do.
    } finally {
      this.saving.set(false);
    }
  }

  logout(): void {
    void this.auth.logout();
  }
}
