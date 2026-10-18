import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Branch } from './models';
import { BranchInventoryApiService } from './api/branch-inventory-api.service';

const SELECTED_BRANCH_KEY = 'drapemind_selected_branch_id';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly api = inject(BranchInventoryApiService);

  private readonly auth = inject(AuthService);
  private owner: number | null = null;
  private get storageKey() {
    return SELECTED_BRANCH_KEY + '_' + (this.auth.user()?.tenant_id || 'none');
  }
  constructor() {
    effect(() => {
      const owner = this.auth.user()?.tenant_id || null;
      if (this.owner !== owner) {
        this.owner = owner;
        this.branches.set([]);
        this.loading.set(false);
        this.selectedBranchId.set(this.readStoredBranchId());
      }
    });
  }
  readonly branches = signal<Branch[]>([]);
  readonly selectedBranchId = signal<number | null>(this.readStoredBranchId());
  readonly showSelectorModal = signal<boolean>(false);
  readonly loading = signal<boolean>(false);

  readonly selectedBranch = computed(() => {
    const id = this.selectedBranchId();
    if (!id) return this.branches()[0] ?? null;
    return this.branches().find((b) => b.id === id) ?? this.branches()[0] ?? null;
  });

  loadBranches(): void {
    const company = this.auth.user()?.tenant_id || null;
    if (!company) return;
    if (this.owner !== company) {
      this.owner = company;
      this.branches.set([]);
      this.loading.set(false);
      this.selectedBranchId.set(this.readStoredBranchId());
    }
    if (this.branches().length > 0 || this.loading()) return;
    this.loading.set(true);

    this.api.branches().subscribe({
      next: (list) => {
        const activeBranches = list.filter((b) => b.activo !== false);
        this.branches.set(activeBranches);
        this.loading.set(false);

        const stored = this.readStoredBranchId();
        if (stored && activeBranches.some((b) => b.id === stored)) {
          this.selectedBranchId.set(stored);
        } else if (activeBranches.length > 0) {
          // Default to first active branch if none stored
          this.selectedBranchId.set(activeBranches[0].id);
          try {
            localStorage.setItem(this.storageKey, String(activeBranches[0].id));
          } catch {
            // ignore storage errors
          }
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  selectBranch(branch: Branch): void {
    this.selectedBranchId.set(branch.id);
    this.showSelectorModal.set(false);
    try {
      localStorage.setItem(this.storageKey, String(branch.id));
    } catch {
      // ignore storage errors
    }
  }

  openSelectorModal(): void {
    this.loadBranches();
    this.showSelectorModal.set(true);
  }

  closeSelectorModal(): void {
    this.showSelectorModal.set(false);
  }

  private readStoredBranchId(): number | null {
    try {
      const val = localStorage.getItem(this.storageKey);
      return val ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  }
}
