import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { AgentTraceStep } from '@core/models';

@Component({
  selector: 'app-tool-activity',
  standalone: true,
  templateUrl: './tool-activity.component.html',
  styleUrl: './tool-activity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolActivityComponent {
  @Input() trace: AgentTraceStep[] = [];
  @Input() pending = false;
  readonly expanded = signal<boolean | null>(null);
  get isOpen(): boolean {
    return this.expanded() ?? this.pending;
  }
  get running(): boolean {
    return this.trace.some((step) => step.state === 'running');
  }
}
