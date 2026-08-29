import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Address, AddressInput, Branch, Product } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(StoreApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly toast = inject(ToastService);

  readonly addresses = signal<Address[]>([]);
  readonly favorites = signal<Product[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly loading = signal(true);
  readonly savingProfile = signal(false);
  readonly savingAddress = signal(false);
  readonly addressEditorOpen = signal(false);
  readonly editingAddressId = signal<number | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    nombre: [this.auth.user()?.nombre ?? '', [Validators.required, Validators.minLength(2)]],
    telefono: [this.auth.user()?.telefono ?? ''],
  });

  readonly addressForm = this.fb.nonNullable.group({
    alias: ['Casa', [Validators.required, Validators.maxLength(50)]],
    departamento: ['Santa Cruz', [Validators.required, Validators.minLength(2)]],
    ciudad: ['Santa Cruz de la Sierra', [Validators.required, Validators.minLength(2)]],
    zona: [''],
    direccion: ['', [Validators.required, Validators.minLength(5)]],
    referencia: [''],
    telefono_contacto: [''],
    es_principal: [false],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      addresses: this.api.myAddresses(),
      favorites: this.api.favorites(),
      branches: this.api.branches(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ addresses, favorites, branches }) => {
          this.addresses.set(addresses);
          this.favorites.set(favorites);
          this.branches.set(branches);
        },
        error: () => this.toast.show('No pudimos sincronizar toda la información de tu cuenta', 'error'),
      });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.savingProfile()) return;
    this.savingProfile.set(true);
    this.api
      .updateMe(this.profileForm.getRawValue())
      .pipe(finalize(() => this.savingProfile.set(false)))
      .subscribe({
        next: () => {
          this.auth.loadMe().subscribe();
          this.toast.show('Perfil actualizado', 'success');
        },
        error: (error) => this.toast.show(error?.error?.detail ?? 'No se pudo actualizar el perfil', 'error'),
      });
  }

  newAddress(): void {
    this.editingAddressId.set(null);
    this.addressForm.reset({
      alias: 'Casa',
      departamento: 'Santa Cruz',
      ciudad: 'Santa Cruz de la Sierra',
      zona: '',
      direccion: '',
      referencia: '',
      telefono_contacto: this.auth.user()?.telefono ?? '',
      es_principal: this.addresses().length === 0,
    });
    this.addressEditorOpen.set(true);
  }

  editAddress(address: Address): void {
    this.editingAddressId.set(address.id);
    this.addressForm.reset({
      alias: address.alias,
      departamento: address.departamento,
      ciudad: address.ciudad,
      zona: address.zona ?? '',
      direccion: address.direccion,
      referencia: address.referencia ?? '',
      telefono_contacto: address.telefono_contacto ?? '',
      es_principal: address.es_principal,
    });
    this.addressEditorOpen.set(true);
  }

  saveAddress(): void {
    if (this.addressForm.invalid || this.savingAddress()) return;
    const payload = this.addressForm.getRawValue() as AddressInput;
    const request = this.editingAddressId()
      ? this.api.updateAddress(this.editingAddressId()!, payload)
      : this.api.createAddress(payload);
    this.savingAddress.set(true);
    request.pipe(finalize(() => this.savingAddress.set(false))).subscribe({
      next: () => {
        this.addressEditorOpen.set(false);
        this.toast.show('Dirección guardada', 'success');
        this.load();
      },
      error: (error) => this.toast.show(error?.error?.detail ?? 'No se pudo guardar la dirección', 'error'),
    });
  }

  deleteAddress(address: Address): void {
    if (!window.confirm(`¿Eliminar la dirección “${address.alias}”?`)) return;
    this.api.deleteAddress(address.id).subscribe({
      next: () => {
        this.toast.show('Dirección eliminada', 'success');
        this.load();
      },
      error: (error) => this.toast.show(error?.error?.detail ?? 'No se pudo eliminar', 'error'),
    });
  }

  removeFavorite(product: Product): void {
    this.api.removeFavorite(product.id).subscribe({
      next: () => {
        this.favorites.update((items) => items.filter((item) => item.id !== product.id));
        this.toast.show('Prenda retirada de favoritos', 'success');
      },
      error: () => this.toast.show('No se pudo actualizar favoritos', 'error'),
    });
  }

  openProduct(product: Product): void {
    void this.router.navigate(['/catalog'], { queryParams: { product: product.id } });
  }

  imageUrl(product: Product): string | null {
    const first = product.imagenes?.[0];
    const raw = typeof first === 'string' ? first : first?.url;
    if (!raw) return null;
    return raw.startsWith('http') ? raw : `${this.runtime.backendUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }
}
