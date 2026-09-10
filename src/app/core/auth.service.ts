import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, switchMap, tap, timeout } from 'rxjs';
import { TokenResponse, User } from './models';
import { RuntimeConfigService } from './runtime-config.service';

const TOKEN_KEY = 'drapemind_access_token';
const USER_KEY = 'drapemind_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfigService);
  private expiryTimer: number | null = null;
  private refreshPending: Promise<void> | null = null;
  private readonly tokenState = signal<string | null>(this.readStoredToken());
  readonly user = signal<User | null>(this.tokenState() ? this.readUser() : null);
  readonly isAuthenticated = computed(() => Boolean(this.tokenState()));
  readonly token = computed(() => this.tokenState());

  constructor() {
    const token = this.tokenState();
    if (token) this.scheduleExpiry(token);
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<TokenResponse>(`${this.runtime.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          sessionStorage.setItem(TOKEN_KEY, response.access_token);
          this.tokenState.set(response.access_token);
          this.scheduleExpiry(response.access_token);
        }),
        switchMap(() => this.loadMe()),
      );
  }

  register(payload: { nombre: string; email: string; password: string; telefono?: string }): Observable<User> {
    return this.http
      .post<User>(`${this.runtime.apiUrl}/auth/register`, payload)
      .pipe(
        switchMap(() => this.login(payload.email, payload.password)),
      );
  }

  forgotPassword(payload: { email: string; new_password: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.runtime.apiUrl}/auth/forgot-password`, payload);
  }

  loadMe(): Observable<User> {
    return this.http.get<User>(`${this.runtime.apiUrl}/auth/me`).pipe(
      tap((user) => {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        this.user.set(user);
      }),
    );
  }

  logout(redirect = true): void {
    this.clearExpiryTimer();
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
    this.user.set(null);
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  hasValidToken(): boolean {
    const token = this.tokenState();
    if (!token) return false;
    if (this.tokenExpiryMs(token) <= Date.now() + 5_000) {
      this.logout();
      return false;
    }
    return true;
  }

  private readStoredToken(): string | null {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token || this.tokenExpiryMs(token) <= Date.now() + 5_000) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
    return token;
  }

  private scheduleExpiry(token: string): void {
    this.clearExpiryTimer();
    const remaining = this.tokenExpiryMs(token) - Date.now();
    const delay = Math.max(5_000, remaining - 60_000);
    if (remaining <= 5_000) {
      this.logout();
      return;
    }
    this.expiryTimer = window.setTimeout(
      () => void this.renewSession(),
      Math.min(delay, 2_147_000_000),
    );
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      window.clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private renewSession(): Promise<void> {
    if (this.refreshPending) return this.refreshPending;
    const previous = this.tokenState();
    if (!previous || this.tokenExpiryMs(previous) <= Date.now() + 5_000) {
      this.logout();
      return Promise.resolve();
    }
    this.refreshPending = firstValueFrom(
      this.http.post<TokenResponse>(this.runtime.apiUrl + '/auth/refresh', {}).pipe(timeout(10_000)),
    ).then((response) => {
      if (this.tokenState() !== previous) return;
      sessionStorage.setItem(TOKEN_KEY, response.access_token);
      this.tokenState.set(response.access_token);
      this.scheduleExpiry(response.access_token);
    }).catch(() => {
      if (this.tokenState() !== previous) return;
      this.clearExpiryTimer();
      this.expiryTimer = window.setTimeout(() => void this.renewSession(), 5_000);
    }).finally(() => { this.refreshPending = null; });
    return this.refreshPending;
  }

  private tokenExpiryMs(token: string): number {
    try {
      const segment = token.split('.')[1];
      if (!segment) return 0;
      const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const payload = JSON.parse(window.atob(padded)) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }

  private readUser(): User | null {
    const value = sessionStorage.getItem(USER_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as User;
    } catch {
      return null;
    }
  }
}
