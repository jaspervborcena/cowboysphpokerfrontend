import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { FirebaseAuthService } from './firebase-auth.service';
import { UserSessionStore } from './user-session.store';

export const firebaseTokenRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const firebaseAuth = inject(FirebaseAuthService);
  const session = inject(UserSessionStore);

  return next(request).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse)
      || error.status !== 401
      || Number(error.error?.code) !== 40101
      || !request.headers.has('Authorization')
      || !isIdempotentRequest(request.method, request.body)) {
      return throwError(() => error);
    }

    return from(firebaseAuth.getCurrentIdToken(true)).pipe(
      catchError(() => throwError(() => error)),
      switchMap((idToken) => {
        if (!idToken) return throwError(() => error);
        session.firebaseIdToken.set(idToken);
        return next(request.clone({ setHeaders: { Authorization: `Bearer ${idToken}` } }));
      })
    );
  }));
};

function isIdempotentRequest(method: string, body: unknown): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  if (method !== 'POST' || typeof body !== 'object' || body === null) return false;

  return ('buy_in_id' in body && typeof body.buy_in_id === 'string' && body.buy_in_id.trim().length > 0)
    || ('transaction_id' in body && typeof body.transaction_id === 'string' && body.transaction_id.trim().length > 0);
}
