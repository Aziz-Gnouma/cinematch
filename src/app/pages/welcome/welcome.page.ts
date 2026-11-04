import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner } from '@ionic/angular';

import { AuthService, authErrorMessage } from '../../core/services/auth.service';

@Component({
  selector: 'app-welcome',
  templateUrl: 'welcome.page.html',
  styleUrls: ['welcome.page.scss'],
  imports: [FormsModule, RouterLink, IonContent, IonInput, IonButton, IonSpinner],
})
export class WelcomePage {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly kickedOut = this.auth.kickedOut;

  readonly frames = Array.from({ length: 14 }, (_, i) => i);

  async submit(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Renseignez votre email et votre mot de passe.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/tabs/discover', { replaceUrl: true });
    } catch (e) {
      this.error.set(authErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
