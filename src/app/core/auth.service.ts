import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, switchMap, tap } from 'rxjs';
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
    const delay = this.tokenExpiryMs(token) - Date.now() - 2_000;
    if (delay <= 0) {
      this.logout(false);
      return;
    }
    this.expiryTimer = window.setTimeout(
      () => this.logout(),
      Math.min(delay, 2_147_000_000),
    );
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      window.clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
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
