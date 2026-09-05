import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    telefono: [''],
  });

  toggleMode(): void {
    const next = this.mode() === 'login' ? 'register' : 'login';
    this.mode.set(next);
    this.error.set('');
    if (next === 'register') {
      this.form.controls.nombre.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      this.form.controls.nombre.clearValidators();
    }
    this.form.controls.nombre.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { nombre, email, password, telefono } = this.form.getRawValue();

    if (this.mode() === 'register') {
      this.auth
        .register({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          password,
          telefono: telefono?.trim() || undefined,
        })
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => void this.router.navigate(['/dashboard']),
          error: (error) =>
            this.error.set(error?.error?.detail ?? 'No pudimos crear la cuenta. Revisa tus datos.'),
        });
    } else {
      this.auth
        .login(email.trim().toLowerCase(), password)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => void this.router.navigate(['/dashboard']),
          error: (error) =>
            this.error.set(error?.error?.detail ?? 'No pudimos iniciar sesión. Revisa tus datos.'),
        });
    }
  }
}
