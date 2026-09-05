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

  readonly mode = signal<'login' | 'register' | 'forgot'>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly successMessage = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    telefono: [''],
  });

  setMode(target: 'login' | 'register' | 'forgot'): void {
    this.mode.set(target);
    this.error.set('');
    this.successMessage.set('');

    if (target === 'register') {
      this.form.controls.nombre.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      this.form.controls.nombre.clearValidators();
    }
    this.form.controls.nombre.updateValueAndValidity();
  }

  toggleMode(): void {
    const next = this.mode() === 'login' ? 'register' : 'login';
    this.setMode(next);
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.successMessage.set('');
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
          error: (error) => {
            if (error?.status === 409) {
              this.error.set('Este correo ya está registrado en el atelier. Inicia sesión directamente o recupera tu contraseña si la olvidaste.');
            } else {
              this.error.set(error?.error?.detail ?? 'No pudimos crear la cuenta. Revisa tus datos.');
            }
          },
        });
    } else if (this.mode() === 'forgot') {
      this.auth
        .forgotPassword({
          email: email.trim().toLowerCase(),
          new_password: password,
        })
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (res) => {
            this.successMessage.set(res?.message ?? '¡Contraseña restablecida con éxito! Ingresa tu nueva contraseña para acceder.');
            this.form.controls.password.reset();
            this.mode.set('login');
          },
          error: (error) => {
            this.error.set(error?.error?.detail ?? 'No pudimos restablecer la contraseña. Verifica que el correo esté registrado.');
          },
        });
    } else {
      this.auth
        .login(email.trim().toLowerCase(), password)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () => void this.router.navigate(['/dashboard']),
          error: (error) =>
            this.error.set(error?.error?.detail ?? 'Credenciales incorrectas. Revisa tu correo y contraseña.'),
        });
    }
  }
}
