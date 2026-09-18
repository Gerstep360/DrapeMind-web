import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { ToastService } from '@core/toast.service';
import { User, UserRole, UserStatus } from '@core/models';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users-management.component.html',
  styleUrl: './users-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(false);

  // Filters
  readonly selectedRole = signal<string>('TODOS');
  readonly searchQuery = signal<string>('');

  // Modal
  readonly userModalOpen = signal(false);
  readonly editingUser = signal<User | null>(null);

  userForm!: FormGroup;

  readonly rolesList: UserRole[] = ['ADMIN', 'ENCARGADO', 'VENDEDOR', 'CAJERO', 'CLIENTE'];
  readonly statusList: UserStatus[] = ['ACTIVO', 'SUSPENDIDO', 'INACTIVO'];

  ngOnInit(): void {
    this.initForm();
    this.loadUsers();
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      telefono: [''],
      rol: ['CLIENTE', [Validators.required]],
      estado: ['ACTIVO', [Validators.required]],
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    const roleFilter = this.selectedRole() === 'TODOS' ? undefined : this.selectedRole();
    this.adminApi.listUsers({ rol: roleFilter, limit: 100 }).subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.show('Error al cargar usuarios: ' + (err.error?.detail || err.message), 'error');
        this.loading.set(false);
      },
    });
  }

  onRoleFilterChange(role: string): void {
    this.selectedRole.set(role);
    this.loadUsers();
  }

  filteredUsers(): User[] {
    const q = this.searchQuery().trim().toLowerCase();
    return this.users().filter((u) => {
      return (
        !q ||
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.telefono && u.telefono.toLowerCase().includes(q))
      );
    });
  }

  openNewUserModal(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      nombre: '',
      email: '',
      password: '',
      telefono: '',
      rol: 'CLIENTE',
      estado: 'ACTIVO',
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.userModalOpen.set(true);
  }

  openEditUserModal(user: User): void {
    this.editingUser.set(user);
    this.userForm.patchValue({
      nombre: user.nombre,
      email: user.email,
      password: '',
      telefono: user.telefono || '',
      rol: user.rol,
      estado: user.estado,
    });
    // For editing, password is optional (only update if provided)
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.setValidators([Validators.minLength(8)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.userModalOpen.set(true);
  }

  closeUserModal(): void {
    this.userModalOpen.set(false);
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    const val = this.userForm.value;
    const editing = this.editingUser();

    if (editing) {
      const payload: any = {
        nombre: val.nombre,
        telefono: val.telefono || null,
        rol: val.rol,
        estado: val.estado,
      };
      if (val.password && val.password.trim()) {
        payload.password = val.password.trim();
      }

      this.adminApi.updateUser(editing.id, payload).subscribe({
        next: () => {
          this.toasts.show(`Usuario "${val.nombre}" actualizado con éxito`, 'info');
          this.closeUserModal();
          this.loadUsers();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar usuario: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createUser(val).subscribe({
        next: () => {
          this.toasts.show(`Usuario "${val.nombre}" registrado con éxito`, 'info');
          this.closeUserModal();
          this.loadUsers();
        },
        error: (err) => {
          this.toasts.show('Error al crear usuario: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  toggleUserStatus(user: User): void {
    this.adminApi.toggleUserStatus(user.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado modificado', 'info');
        this.loadUsers();
      },
      error: (err) => {
        this.toasts.show('Error al modificar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  getInitials(name: string): string {
    if (!name) return 'DM';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Stats
  staffCount(): number {
    return this.users().filter((u) => u.rol !== 'CLIENTE').length;
  }

  clientsCount(): number {
    return this.users().filter((u) => u.rol === 'CLIENTE').length;
  }

  activeCount(): number {
    return this.users().filter((u) => u.estado === 'ACTIVO').length;
  }
}
