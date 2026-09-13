import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AgentTraceStep } from '@core/models';

@Component({
  selector: 'app-thinking-dropdown',
  standalone: true,
  templateUrl: './thinking-dropdown.component.html',
  styleUrl: './thinking-dropdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThinkingDropdownComponent {
  @Input() pending = false;
  @Input() currentThought?: string | null = null;
  @Input() thinkingElapsedFormatted = '0.0s';
  @Input() thoughtSteps?: string[] = [];
  @Input() trace?: AgentTraceStep[] = [];
  @Input() isOpen = false;
  @Input() thinkingTime?: string = '';
  @Input() hasContent = false;

  @Output() toggle = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onToggle(): void {
    this.toggle.emit();
  }

  onCancel(event: Event): void {
    event.stopPropagation();
    this.cancel.emit();
  }
}
