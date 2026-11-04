import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack, camera, refresh } from 'ionicons/icons';

import { AuthService, authErrorMessage } from '../../core/services/auth.service';
import { CameraService } from '../../core/services/camera.service';

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  imports: [FormsModule, RouterLink, IonContent, IonInput, IonButton, IonSpinner, IonIcon],
})
export class RegisterPage {
  private auth = inject(AuthService);
  private camera = inject(CameraService);
  private router = inject(Router);

  form = { firstName: '', lastName: '', age: null as number | null, email: '', password: '' };
  readonly photo = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    addIcons({ arrowBack, camera, refresh });
  }

  async takePhoto(): Promise<void> {
    try {
      this.photo.set(await this.camera.takeSelfie());
      this.error.set('');
    } catch (e) {
      const msg = String((e as Error)?.message ?? '');
      if (!/cancel/i.test(msg)) this.error.set("Impossible d'accéder à la caméra.");
    }
  }

  async submit(): Promise<void> {
    const f = this.form;
    const err = this.validate();
    if (err) {
      this.error.set(err);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.register({
        email: f.email,
        password: f.password,
        firstName: f.firstName,
        lastName: f.lastName,
        age: Number(f.age),
        photo: this.photo(),
      });
      await this.router.navigateByUrl('/tabs/discover', { replaceUrl: true });
    } catch (e) {
      this.error.set(authErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  private validate(): string {
    const f = this.form;
    if (!this.photo()) return 'Prenez une photo de profil avec la caméra.';
    if (!f.firstName.trim() || !f.lastName.trim()) return 'Nom et prénom sont obligatoires.';
    const age = Number(f.age);
    if (!Number.isInteger(age) || age < 10 || age > 120) return 'Âge invalide (10 – 120 ans).';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return 'Adresse email invalide.';
    if (f.password.length < 6) return 'Mot de passe : 6 caractères minimum.';
    return '';
  }
}
