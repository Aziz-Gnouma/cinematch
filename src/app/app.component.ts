import { Component, effect, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { AuthService } from './core/services/auth.service';
import { MovieService } from './core/services/movie.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private auth = inject(AuthService);
  private movies = inject(MovieService);

  constructor() {
    // The catalogue is only readable by active users (see firestore.rules).
    effect(() => (this.auth.isLoggedIn() ? this.movies.watch() : this.movies.stop()));
  }
}
