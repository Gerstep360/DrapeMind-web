import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '@core/auth.service';
import { TenantService } from '@core/tenant.service';
import { SaaSService, saasError } from '@core/saas.service';
import { BranchService } from '@core/branch.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly branchService = inject(BranchService);
  private readonly router = inject(Router);

  readonly tenant = inject(TenantService);
  private readonly saas = inject(SaaSService);
  readonly platform = signal(false);
  readonly mode = signal<'login' | 'register' | 'forgot'>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly successMessage = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    company: [
      this.tenant.slug(),
      [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)],
    ],
    nombre: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    telefono: [''],
  });

  togglePlatform(): void {
    this.platform.set(!this.platform());
    if (this.platform()) this.form.controls.company.disable();
    else this.form.controls.company.enable();
  }

  setMode(target: 'login' | 'register' | 'forgot'): void {
    if (target !== 'login' && this.platform()) this.togglePlatform();
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
    if (!this.platform()) this.tenant.select(this.form.controls.company.value);
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
          next: () => {
            this.branchService.loadBranches();
            void this.router.navigate(['/onboarding']);
          },
          error: (error) => {
            if (error?.status === 409) {
              this.error.set(
                'Este correo ya está registrado en el atelier. Inicia sesión directamente o recupera tu contraseña si la olvidaste.',
              );
            } else {
              this.error.set(
                error?.error?.detail ?? 'No pudimos crear la cuenta. Revisa tus datos.',
              );
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
            this.successMessage.set(
              res?.message ??
                '¡Contraseña restablecida con éxito! Ingresa tu nueva contraseña para acceder.',
            );
            this.form.controls.password.reset();
            this.mode.set('login');
          },
          error: (error) => {
            this.error.set(
              error?.error?.detail ??
                'No pudimos restablecer la contraseña. Verifica que el correo esté registrado.',
            );
          },
        });
    } else {
      this.auth
        .login(email.trim().toLowerCase(), password, this.platform())
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (user) => {
            if (user.is_platform_admin) {
              void this.router.navigate(['/saas-platform']);
              return;
            }
            this.saas.load().subscribe({
              next: (state) => {
                if (!state.access_active) void this.router.navigate(['/subscription']);
              },
              error: () => {},
            });
            this.branchService.loadBranches();
            if (user.rol === 'CLIENTE' && user.has_style_profile === false) {
              void this.router.navigate(['/onboarding']);
            } else {
              void this.router.navigate(['/dashboard']);
            }
          },
          error: (error) =>
            this.error.set(
              error?.error?.detail ?? 'Credenciales incorrectas. Revisa tu correo y contraseña.',
            ),
        });
    }
  }
}
