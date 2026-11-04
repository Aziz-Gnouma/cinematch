import { Injectable, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { User } from 'firebase/auth';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import { auth, db } from '../firebase';
import type { AppUser } from '../models';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age: number;
  photo: string;
}

export class DisabledAccountError extends Error {
  constructor() {
    super('Ce compte a été désactivé par un administrateur.');
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  readonly firebaseUser = signal<User | null>(null);
  readonly profile = signal<AppUser | null>(null);
  /** True once the first auth state + profile have been resolved. */
  readonly ready = signal(false);
  /** Set when the session was closed because the account got disabled. */
  readonly kickedOut = signal(false);

  readonly isLoggedIn = computed(() => !!this.profile() && !this.profile()!.disabled);
  readonly isAdmin = computed(() => this.profile()?.role === 'admin');

  private profileSub?: Unsubscribe;
  private readyPromise: Promise<void>;

  constructor() {
    let resolveReady!: () => void;
    this.readyPromise = new Promise((r) => (resolveReady = r));

    onAuthStateChanged(auth, (user) => {
      this.firebaseUser.set(user);
      this.profileSub?.();
      this.profileSub = undefined;

      if (!user) {
        this.profile.set(null);
        this.markReady(resolveReady);
        return;
      }

      // Live profile: if an admin disables the account while the user is
      // connected, the session is closed immediately.
      this.profileSub = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const data = snap.exists() ? (snap.data() as AppUser) : null;
          if (data?.disabled) {
            this.kickedOut.set(true);
            this.profile.set(null);
            void this.logout();
          } else {
            this.profile.set(data);
          }
          this.markReady(resolveReady);
        },
        () => this.markReady(resolveReady),
      );
    });
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async register(p: RegisterPayload): Promise<void> {
    const cred = await createUserWithEmailAndPassword(auth, p.email.trim(), p.password);
    const profile: AppUser = {
      uid: cred.user.uid,
      email: p.email.trim().toLowerCase(),
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
      age: Number(p.age),
      photo: p.photo,
      role: 'user',
      disabled: false,
      favorites: [],
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    this.profile.set(profile);
  }

  async login(email: string, password: string): Promise<void> {
    this.kickedOut.set(false);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists() || (snap.data() as AppUser).disabled) {
      await signOut(auth);
      throw new DisabledAccountError();
    }
    this.profile.set(snap.data() as AppUser);
  }

  async logout(): Promise<void> {
    this.profileSub?.();
    this.profileSub = undefined;
    await signOut(auth);
    this.profile.set(null);
    await this.router.navigateByUrl('/welcome', { replaceUrl: true });
  }

  private markReady(resolve: () => void) {
    if (!this.ready()) {
      this.ready.set(true);
      resolve();
    }
  }
}

export function authErrorMessage(err: unknown): string {
  if (err instanceof DisabledAccountError) return err.message;
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/wrong-password': 'Email ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/weak-password': 'Mot de passe trop faible (6 caractères minimum).',
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/too-many-requests': 'Trop de tentatives, réessayez plus tard.',
    'auth/network-request-failed': 'Problème de connexion réseau.',
    'permission-denied': 'Action non autorisée.',
  };
  return map[code] ?? 'Une erreur est survenue. Réessayez.';
}
