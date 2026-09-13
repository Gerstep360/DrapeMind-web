import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AiSocketService } from '@core/ai-socket.service';
import { AuthService } from '@core/auth.service';
import { CartService } from '@core/cart.service';
import { EventsSocketService } from '@core/events-socket.service';
import { ToastService } from '@core/toast.service';
import { CartDrawerComponent } from '@shared/components/cart/cart-drawer/cart-drawer.component';
import { BranchService } from '@core/branch.service';
import { Branch } from '@core/models';
import { navigationForRole } from '@core/navigation/package-navigation';
import { NavIconComponent } from '@shared/components/navigation/nav-icon/nav-icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CartDrawerComponent, NavIconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly events = inject(EventsSocketService);
  readonly toasts = inject(ToastService);
  readonly branchService = inject(BranchService);
  private readonly ai = inject(AiSocketService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly isBranchDropdownOpen = signal(false);

  readonly navigation = computed(() => {
    return navigationForRole(this.auth.user()?.rol);
  });

  constructor() {
    this.events.connect();
    this.branchService.loadBranches();

    // Si el usuario aún no calibra su ADN de estilo, redirigir a la experiencia de onboarding
    const user = this.auth.user();
    if (
      user &&
      user.has_style_profile === false &&
      this.auth.onboardingSkippedForUser() !== user.id
    ) {
      void this.router.navigate(['/onboarding']);
    }
  }

  toggleBranchDropdown(): void {
    this.isBranchDropdownOpen.set(!this.isBranchDropdownOpen());
  }

  chooseBranch(branch: Branch): void {
    this.branchService.selectBranch(branch);
    this.isBranchDropdownOpen.set(false);
    this.toasts.show(
      `Sucursal activa: ${branch.nombre}. Disponibilidad física sincronizada.`,
      'info',
    );
  }

  openBranchSelectorModal(): void {
    this.isBranchDropdownOpen.set(false);
    this.branchService.openSelectorModal();
  }

  logout(): void {
    this.events.disconnect();
    this.ai.disconnect();
    this.auth.logout();
  }
}
