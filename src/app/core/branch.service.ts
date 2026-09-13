import { Injectable, computed, inject, signal } from '@angular/core';
import { Branch } from './models';
import { BranchInventoryApiService } from './api/branch-inventory-api.service';

const SELECTED_BRANCH_KEY = 'drapemind_selected_branch_id';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly api = inject(BranchInventoryApiService);

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
            localStorage.setItem(SELECTED_BRANCH_KEY, String(activeBranches[0].id));
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
      localStorage.setItem(SELECTED_BRANCH_KEY, String(branch.id));
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
      const val = localStorage.getItem(SELECTED_BRANCH_KEY);
      return val ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  }
}
