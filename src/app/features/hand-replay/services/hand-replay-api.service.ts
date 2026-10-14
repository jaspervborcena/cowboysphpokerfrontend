import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { UserSessionStore } from '../../../core/user-session.store';
import { ReplayPayload } from '../models/hand-replay.models';

@Injectable({ providedIn: 'root' })
export class HandReplayApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(UserSessionStore);

  getReplay(
    apiBase: string,
    clubId: string,
    handId: string,
    unionId: string | null = null
  ): Observable<ReplayPayload> {
    const idToken = this.session.firebaseIdToken();
    if (!idToken) {
      return throwError(() => new Error('Sign in with Firebase to view this hand replay.'));
    }

    const url = unionId
      ? `${apiBase.replace(/\/$/, '')}/unions/${encodeURIComponent(unionId)}/hands/${encodeURIComponent(handId)}/replay?club_id=${encodeURIComponent(clubId)}`
      : `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/hands/${encodeURIComponent(handId)}/replay`;
    return this.http.get<ReplayPayload>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }
}