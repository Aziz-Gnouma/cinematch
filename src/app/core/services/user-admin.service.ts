import { Injectable, signal } from '@angular/core';
import type { Unsubscribe } from 'firebase/firestore';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { AppUser } from '../models';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  readonly users = signal<AppUser[]>([]);
  private sub?: Unsubscribe;

  watch(): void {
    if (this.sub) return;
    this.sub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => d.data() as AppUser);
      list.sort((a, b) => b.createdAt - a.createdAt);
      this.users.set(list);
    });
  }

  stop(): void {
    this.sub?.();
    this.sub = undefined;
  }

  setDisabled(uid: string, disabled: boolean): Promise<void> {
    return updateDoc(doc(db, 'users', uid), { disabled });
  }
}
