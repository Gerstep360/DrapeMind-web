import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { User, UserRole } from '@core/models';
import { AuthService } from '@core/auth.service';
import { saasError } from '@core/saas.service';

interface Permission { key: string; group: string; label: string; delegable: boolean }
interface CompanyRole { id?: number; nombre: string; descripcion: string; base_role: UserRole; permisos: string[]; activo: boolean }
interface Access { base_role: UserRole; role: { id: number; activo: boolean } | null; overrides: Record<string, boolean> }

@Component({
  selector: 'app-team-access', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './team-access.component.html', styleUrl: './team-access.component.scss',
})
export class TeamAccessComponent {
  readonly changed = output<void>();
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly auth = inject(AuthService);
  @ViewChild('editor') editor!: ElementRef<HTMLDialogElement>;
  @ViewChild('notice') notice!: ElementRef<HTMLDialogElement>;
  readonly roles = signal<CompanyRole[]>([]);
  readonly catalog = signal<Permission[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly mode = signal<'role' | 'user'>('role');
  readonly target = signal<User | null>(null);
  readonly clientPermissions = ['catalog.read', 'offline.use'];
  readonly baseRoles: UserRole[] = ['CAJERO', 'ENCARGADO', 'VENDEDOR', 'PROVEEDOR', 'CLIENTE'];
  defaults: Record<string, string[]> = {};
  role: CompanyRole = this.emptyRole();
  profile: number | null = null;
  overrides: Record<string, boolean> = {};
  subject = ''; message = ''; destination = '/catalog';

  constructor() { this.reload(); }
  private emptyRole(): CompanyRole { return { nombre: '', descripcion: '', base_role: 'CAJERO', permisos: [], activo: true }; }
  reload(): void {
    this.loading.set(true);
    forkJoin({ roles: this.http.get<CompanyRole[]>(this.runtime.apiUrl + '/team/roles'),
      catalog: this.http.get<{ permissions: Permission[]; defaults: Record<string, string[]> }>(this.runtime.apiUrl + '/team/catalog') }).subscribe({
      next: ({ roles, catalog }) => { this.roles.set(roles); this.catalog.set(catalog.permissions); this.defaults = catalog.defaults; this.loading.set(false); },
      error: e => { this.error.set(saasError(e)); this.loading.set(false); },
    });
  }
  openRole(role?: CompanyRole): void {
    this.mode.set('role'); this.error.set(''); this.feedback.set('');
    this.role = role ? { ...role, permisos: [...role.permisos] } : this.emptyRole();
    if (!role) this.role.permisos = [...(this.defaults['CAJERO'] || [])];
    this.editor.nativeElement.showModal();
  }
  changeBase(): void { this.role.permisos = [...(this.defaults[this.role.base_role] || [])].filter(p => p !== 'team.manage'); }
  togglePermission(key: string, checked: boolean): void {
    this.role.permisos = checked ? [...new Set([...this.role.permisos, key])] : this.role.permisos.filter(p => p !== key);
  }
  openUser(user: User): void {
    this.target.set(user); this.mode.set('user'); this.error.set(''); this.feedback.set(''); this.saving.set(true);
    this.http.get<Access>(`${this.runtime.apiUrl}/team/users/${user.id}/access`).subscribe({
      next: access => { this.profile = access.role?.id || null; this.overrides = { ...access.overrides }; this.saving.set(false); this.editor.nativeElement.showModal(); },
      error: e => { this.saving.set(false); this.error.set(saasError(e)); },
    });
  }
  availableRoles(): CompanyRole[] { return this.roles().filter(r => r.activo && (!this.target()?.is_universal_customer || r.base_role === 'CLIENTE')); }
  changeProfile(): void { this.overrides = {}; }
  permissions(): Permission[] {
    const base = this.mode() === 'role' ? this.role.base_role : this.roles().find(r => r.id === this.profile)?.base_role || this.target()?.rol;
    return this.catalog().filter(p => p.delegable && (base !== 'CLIENTE' || this.clientPermissions.includes(p.key)));
  }
  inherited(key: string): boolean {
    const role = this.roles().find(r => r.id === this.profile);
    return role ? role.activo && role.permisos.includes(key) : (this.defaults[this.target()?.rol || 'CLIENTE'] || []).includes(key);
  }
  override(key: string, value: string): void {
    const next = { ...this.overrides };
    if (value === 'inherit') delete next[key]; else next[key] = value === 'allow';
    this.overrides = next;
  }
  save(): void {
    if (this.saving()) return;
    this.error.set('');
    if (this.mode() === 'role' && this.role.nombre.trim().length < 2) { this.error.set('Escribe un nombre para este rol.'); return; }
    this.saving.set(true);
    const request = this.mode() === 'role'
      ? this.role.id ? this.http.put(this.runtime.apiUrl + '/team/roles/' + this.role.id, this.roleBody()) : this.http.post(this.runtime.apiUrl + '/team/roles', this.roleBody())
      : this.http.put(`${this.runtime.apiUrl}/team/users/${this.target()!.id}/access`, { rol_empresa_id: this.profile, permisos: this.overrides });
    request.subscribe({ next: () => { this.saving.set(false); this.editor.nativeElement.close(); this.feedback.set('Permisos guardados. Se aplican desde la siguiente consulta de la persona.'); this.reload(); this.changed.emit(); },
      error: e => { this.saving.set(false); this.error.set(saasError(e)); } });
  }
  private roleBody() { const { id, ...body } = this.role; return body; }
  openNotice(user: User): void {
    this.target.set(user); this.subject = ''; this.message = ''; this.destination = '/catalog'; this.error.set(''); this.feedback.set(''); this.notice.nativeElement.showModal();
  }
  sendNotice(): void {
    if (this.saving() || this.subject.trim().length < 2 || this.message.trim().length < 2) return;
    this.saving.set(true); this.error.set('');
    this.http.post<{ delivery: {sent: number; failed: number; devices: number} }>(this.runtime.apiUrl + '/notifications/send', {
      usuario_id: this.target()!.id, titulo: this.subject.trim(), mensaje: this.message.trim(), screen: this.destination,
    }).subscribe({ next: ({ delivery }) => { this.saving.set(false); this.notice.nativeElement.close(); this.feedback.set(`Aviso guardado para ${this.target()!.nombre}. Entregas aceptadas: ${delivery.sent}; pendientes o fallidas: ${delivery.failed}.`); },
      error: e => { this.saving.set(false); this.error.set(saasError(e)); } });
  }
}
