import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AiModelMode } from '@core/models';
import { ChatComposerComponent } from '../chat-composer/chat-composer.component';
import { ComposerSubmitEvent } from '../altair-component.models';

@Component({
  selector: 'app-altair-launcher',
  standalone: true,
  imports: [ChatComposerComponent],
  templateUrl: './altair-launcher.component.html',
  styleUrl: './altair-launcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AltairLauncherComponent {
  private readonly router = inject(Router);

  @Input() open = true;
  @Input() title = 'Conversa con Altair';
  @Input() description = 'La misma sesión, herramientas y configuración del asistente principal.';
  @Input() context = '';
  @Input() modal = false;
  @Output() closed = new EventEmitter<void>();

  readonly model = signal<AiModelMode>(this.readModel());

  selectModel(value: AiModelMode): void {
    this.model.set(value);
    try {
      localStorage.setItem('drapemind_altair_model', value);
    } catch {
      /* storage optional */
    }
  }

  async submit(event: ComposerSubmitEvent): Promise<void> {
    await this.router.navigate(['/ai-studio'], {
      queryParams: {
        autoQuery: event.text,
        context: this.context.trim() || null,
        mode: this.model(),
        command: event.commandLabel || null,
      },
    });
    this.closed.emit();
  }

  async openOutfitBuilder(): Promise<void> {
    await this.router.navigate(['/ai-studio'], {
      queryParams: {
        openConfigurator: true,
        context: this.context.trim() || null,
        mode: this.model(),
      },
    });
    this.closed.emit();
  }

  private readModel(): AiModelMode {
    try {
      const value = localStorage.getItem('drapemind_altair_model');
      if (value === 'mini' || value === 'dynamic' || value === 'gemma') return value;
    } catch {
      /* storage optional */
    }
    return 'dynamic';
  }
}
