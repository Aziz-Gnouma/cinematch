import type { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'welcome',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/welcome/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'discover',
        loadComponent: () => import('./pages/discover/discover.page').then((m) => m.DiscoverPage),
      },
      {
        path: 'playlist',
        loadComponent: () => import('./pages/playlist/playlist.page').then((m) => m.PlaylistPage),
      },
      {
        path: 'match',
        loadComponent: () => import('./pages/match/match.page').then((m) => m.MatchPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage),
      },
      { path: '', redirectTo: 'discover', pathMatch: 'full' },
    ],
  },
  {
    path: 'movie/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/movie-detail/movie-detail.page').then((m) => m.MovieDetailPage),
  },
  {
    path: 'admin/new-movie',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/new-movie.page').then((m) => m.NewMoviePage),
  },
  { path: '', redirectTo: 'tabs/discover', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/discover' },
];
