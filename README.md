# CinéMatch 🎬

Application mobile Ionic / Angular de gestion de films avec **matching de goûts** entre cinéphiles.

| Stack | |
|---|---|
| UI | Ionic 9 + Angular 22 (standalone, signals, zoneless) |
| Natif | Capacitor 8 (Camera) — PWA Elements pour la caméra web |
| Données | Firebase Auth (email/mot de passe) + Cloud Firestore |
| Catalogue | API publique TMDB (base de départ) |

## Fonctionnalités

- **Inscription** : nom, prénom, âge et **selfie pris avec la caméra** (recadré 256 px, stocké dans le profil Firestore — pas besoin de Storage / plan payant).
- **Authentification**, session persistée, déconnexion forcée en temps réel si le compte est désactivé.
- **Catalogue** : recherche (titre, acteur, réalisateur), filtres par genre, tri, fiche film.
- **Playlist** de favoris + « ADN cinéma » (genres dominants, décennie, acteurs fétiches).
- **Matching** multicritère, seuil **> 75 %**, détail du score par critère et films en commun.
- **Administration** : import d'une base de départ TMDB (~80 films), recherche/import unitaire, ajout manuel, **désactivation / réactivation** des membres (jamais de suppression).

## Architecture du catalogue

- **Base de départ = TMDB en direct** : Tendances, À l'affiche, Incontournables, Populaires, Prochainement, filtres par genre et recherche. Tout utilisateur voit des films dès sa première connexion.
- **Sélection CinéMatch = Firestore `movies`** : films importés ou saisis par un admin, affichés en tête et inclus dans la recherche.
- **Favoris dénormalisés** : `users/{uid}.favoriteMovies` stocke un instantané de chaque favori (genres, acteurs, réalisateurs, année, langue). La playlist et le matching fonctionnent donc pour n'importe quel film, sans relire le catalogue.

## Algorithme de matching (`src/app/core/matching.ts`)

Chaque utilisateur est réduit à un *profil de goûts* construit à partir de ses favoris :

| Critère | Mesure | Poids |
|---|---|---|
| Genres | cosinus des vecteurs de fréquence | 0.30 |
| Films en commun | coefficient de Sørensen–Dice | 0.20 |
| Acteurs | cosinus (têtes d'affiche ×1, seconds rôles ×0.5) | 0.20 |
| Époque | noyau gaussien σ = 6 ans, meilleur appariement symétrique | 0.15 |
| Réalisateurs | cosinus | 0.075 |
| Langue originale | cosinus | 0.075 |

`score = Σ poids × critère`. Un profil n'apparaît que si **score > 0.75**, et chaque profil doit compter au moins 3 favoris.
Deux personnes peuvent donc matcher sans avoir les mêmes films, à condition de partager genres, acteurs et époque. Tests unitaires : `src/app/core/matching.spec.ts`.

## Mise en route

```bash
npm install
```

1. **Firebase** : créez un projet → *Authentication* → activez *Email/Password* → créez une base *Firestore*.
   Ajoutez une app Web et collez sa config dans `src/environments/app-config.ts`.
2. **TMDB** : créez une clé sur https://www.themoviedb.org/settings/api et renseignez `tmdb.apiKey` (v3) **ou** `tmdb.readAccessToken` (v4) dans le même fichier.
3. **Règles de sécurité** :
   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add          # choisissez votre projet
   firebase deploy --only firestore:rules
   ```
4. **Lancer** : `npm start` → http://localhost:4200
5. **Premier admin** : inscrivez-vous dans l'app, puis dans la console Firestore ouvrez `users/{votre uid}` et passez `role` à `"admin"`.
   (Les règles interdisent qu'un utilisateur se donne lui-même ce rôle.) L'onglet **Admin** apparaît : cliquez sur *Base de départ TMDB*.

### Sur téléphone (Android)

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android
```

Dans `android/app/src/main/AndroidManifest.xml`, vérifiez la permission caméra :

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

(iOS : `npx cap add ios`, puis ajoutez `NSCameraUsageDescription` dans `Info.plist`.)

## Modèle de données

```
users/{uid}   uid, email, firstName, lastName, age, photo (data URL), role: 'user'|'admin',
              disabled: bool, favorites: string[], favoriteMovies: FavoriteMovie[], createdAt
movies/{id}   id, tmdbId?, title, overview, posterUrl, backdropUrl, year, genres[], cast[],
              directors[], language, rating, runtime, source: 'tmdb'|'admin', createdAt
```

## Sécurité (`firestore.rules`)

- un membre ne peut modifier que sa playlist, sa photo et son identité, jamais `role` ni `disabled` ;
- un admin ne peut modifier que `disabled` (et pas sur son propre compte) ; `delete` est interdit sur `users` ;
- un compte désactivé perd tout accès en lecture ;
- seul un admin écrit dans `movies`.

## Scripts

| | |
|---|---|
| `npm start` | serveur de dev |
| `npm run build` | build de production (`www/`) |
| `npm run test:unit` | tests Vitest (moteur de matching) |
| `npm run lint` | ESLint + Prettier |

## Structure

```
src/app/
  core/       firebase.ts, models.ts, matching.ts, guards.ts, services/
  shared/     poster-card.component.ts
  pages/      welcome, register, tabs, discover, movie-detail, playlist, match, profile, admin
```
