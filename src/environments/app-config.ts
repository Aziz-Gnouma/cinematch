// Shared by every build configuration.
// 1. Create a Firebase project → add a Web app → paste its config below.
// 2. Enable Authentication (Email/Password) and Cloud Firestore.
// 3. Get a free TMDB key: https://www.themoviedb.org/settings/api
export const appConfig = {
  firebase: {
    apiKey: 'AIzaSyDnerBvUqs6wCK3_yjGOZiTuik8dGpygM4',
    authDomain: 'movies-app-7dfdf.firebaseapp.com',
    projectId: 'movies-app-7dfdf',
    storageBucket: 'movies-app-7dfdf.firebasestorage.app',
    messagingSenderId: '138462485336',
    appId: '1:138462485336:web:704ef8280fa4e3b28be32d',
  },
  tmdb: {
    // Either a v3 API key or a v4 "API Read Access Token" works.
    apiKey: '0a1e6d5b2c8cb7b4ee67ff15087e5826',
    readAccessToken: '',
    language: 'fr-FR',
  },
};
