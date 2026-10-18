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
  @Input() description = 'Cuéntanos qué buscas y encontraremos algo para ti.';
  @Input() context = '';
  @Input() modal = false;
  @Output() closed = new EventEmitter<void>();

  async submit(event: ComposerSubmitEvent): Promise<void> {
    await this.router.navigate(['/ai-studio'], {
      queryParams: {
        autoQuery: event.text,
        context: this.context.trim() || null,

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

      },
    });
    this.closed.emit();
  }

}
