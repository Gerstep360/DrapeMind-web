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
  private readonly tokenState = signal<string | null>(sessionStorage.getItem(TOKEN_KEY));
  readonly user = signal<User | null>(this.readUser());
  readonly isAuthenticated = computed(() => Boolean(this.tokenState()));
  readonly token = computed(() => this.tokenState());

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<TokenResponse>(`${this.runtime.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          sessionStorage.setItem(TOKEN_KEY, response.access_token);
          this.tokenState.set(response.access_token);
        }),
        switchMap(() => this.loadMe()),
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
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
    this.user.set(null);
    if (redirect) {
      void this.router.navigate(['/login']);
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
