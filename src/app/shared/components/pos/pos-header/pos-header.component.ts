import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Branch, User } from '@core/models';

@Component({
  selector: 'app-pos-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-header.component.html',
  styleUrl: './pos-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosHeaderComponent {
  @Input() branches: Branch[] = [];
  @Input() selectedBranchId: number | null = null;
  @Input() currentUser: User | null = null;

  @Output() branchSelected = new EventEmitter<number>();
  @Output() openAiOutfit = new EventEmitter<void>();

  onBranchChange(val: string | number): void {
    const id = Number(val);
    if (!isNaN(id)) {
      this.branchSelected.emit(id);
    }
  }

  onTriggerAiOutfit(): void {
    this.openAiOutfit.emit();
  }
}
