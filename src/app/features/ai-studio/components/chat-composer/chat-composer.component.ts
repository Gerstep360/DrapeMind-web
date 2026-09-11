import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../../core/toast.service';

export interface ComposerSubmitEvent {
  text: string;
  commandLabel?: string;
}

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chat-composer.component.html',
  styleUrl: './chat-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComposerComponent {
  private readonly toast = inject(ToastService);

  @Input() disabled = false;
  @Input() isBusy = false;
  @Input() activeModel: 'mini' | 'dynamic' | 'gemma' = 'dynamic';

  @Output() sendMessage = new EventEmitter<ComposerSubmitEvent>();
  @Output() cancelGeneration = new EventEmitter<void>();
  @Output() openOutfitBuilder = new EventEmitter<void>();
  @Output() modelChange = new EventEmitter<'mini' | 'dynamic' | 'gemma'>();

  @ViewChild('promptTextarea') promptTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly prompt = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly activeCommand = signal<string | null>(null);
  readonly isPlusMenuOpen = signal(false);
  readonly isModeMenuOpen = signal(false);
  readonly isSlashMenuOpen = signal(false);
  readonly isListening = signal(false);

  private speechRecognition: any = null;

  readonly slashCommands = [
    {
      label: 'Look por Presupuesto',
      desc: 'Recomienda outfit por presupuesto máximo en Bs',
      template: 'Recomiéndame un outfit moderno y elegante por menos de Bs 400 con piezas del showroom.',
    },
    {
      label: 'Analizar Perchero',
      desc: 'Revisa prendas del perchero y sugiere combinaciones',
      template: 'Analiza las prendas de mi perchero y recomiéndame combinaciones de estilo.',
    },
    {
      label: 'Explorar Catálogo',
      desc: 'Descubre piezas exclusivas y novedades',
      template: 'Muéstrame las prendas más destacadas y recientes disponibles en el catálogo.',
    },
    {
      label: 'Diseñar Outfit a Medida',
      desc: 'Diseña un look completo según criterio estético y ocasión',
      template: 'Diseña un outfit completo según ocasión, corte y tallas.',
    },
  ];

  clearActiveCommand(): void {
    this.activeCommand.set(null);
  }

  selectSlashCommand(cmd: { label: string; desc: string; template: string }): void {
    this.activeCommand.set(cmd.label);
    this.prompt.setValue(cmd.template);
    this.isSlashMenuOpen.set(false);
    this.focusPrompt();
  }

  onInputChange(): void {
    const val = (this.prompt.value || '').trim();
    if (val === '/' && !this.activeCommand()) {
      this.isSlashMenuOpen.set(true);
    } else if (!val.startsWith('/')) {
      this.isSlashMenuOpen.set(false);
    }
  }

  focusPrompt(): void {
    setTimeout(() => {
      this.promptTextarea?.nativeElement?.focus();
    }, 50);
  }

  togglePlusMenu(): void {
    this.isPlusMenuOpen.update((v) => !v);
    if (this.isPlusMenuOpen()) {
      this.isModeMenuOpen.set(false);
      this.isSlashMenuOpen.set(false);
    }
  }

  closePlusMenu(): void {
    this.isPlusMenuOpen.set(false);
  }

  toggleModeMenu(): void {
    this.isModeMenuOpen.update((v) => !v);
    if (this.isModeMenuOpen()) {
      this.isPlusMenuOpen.set(false);
      this.isSlashMenuOpen.set(false);
    }
  }

  closeModeMenu(): void {
    this.isModeMenuOpen.set(false);
  }

  selectModel(model: 'mini' | 'dynamic' | 'gemma'): void {
    this.modelChange.emit(model);
    this.closeModeMenu();
  }

  executeOutfitBuilder(): void {
    this.closePlusMenu();
    this.openOutfitBuilder.emit();
  }

  executeClosetAnalysis(): void {
    this.closePlusMenu();
    this.activeCommand.set('Analizar Perchero');
    this.prompt.setValue('Analiza las prendas de mi perchero y recomiéndame combinaciones de estilo.');
    this.focusPrompt();
  }

  executeBudgetLook(): void {
    this.closePlusMenu();
    this.activeCommand.set('Look por Presupuesto');
    this.prompt.setValue('Recomiéndame un outfit moderno y elegante por menos de Bs 400 con piezas del showroom.');
    this.focusPrompt();
  }

  executeCatalogExplore(): void {
    this.closePlusMenu();
    this.activeCommand.set('Explorar Catálogo');
    this.prompt.setValue('Muéstrame las prendas más destacadas y recientes disponibles en el catálogo.');
    this.focusPrompt();
  }

  toggleVoiceRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      this.toast.show('Tu navegador no admite dictado de voz nativo.', 'info');
      return;
    }

    if (this.isListening() && this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch {}
      this.isListening.set(false);
      return;
    }

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.lang = 'es-BO';
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onstart = () => {
        this.isListening.set(true);
      };

      this.speechRecognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          this.prompt.setValue(transcript.trim());
        }
      };

      this.speechRecognition.onerror = (err: any) => {
        this.isListening.set(false);
        if (err?.error !== 'no-speech') {
          this.toast.show('Error al acceder al micrófono. Verifica los permisos.', 'info');
        }
      };

      this.speechRecognition.onend = () => {
        this.isListening.set(false);
      };

      this.speechRecognition.start();
    } catch {
      this.isListening.set(false);
      this.toast.show('No se pudo iniciar el dictado por voz.', 'info');
    }
  }

  onKeydown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key === 'Enter' && !keyboard.shiftKey) {
      keyboard.preventDefault();
      this.send();
    }
  }

  send(overrideText?: string): void {
    const raw = (overrideText ?? this.prompt.value ?? '').trim();
    if (!raw && !this.activeCommand()) return;
    if (this.isBusy) return;

    const cmdLabel = this.activeCommand();
    let fullContent = raw;
    if (cmdLabel) {
      const prefix = `/${cmdLabel}`.toLowerCase();
      if (!raw.toLowerCase().startsWith(prefix)) {
        fullContent = `/${cmdLabel} ${raw}`.trim();
      }
    }

    this.sendMessage.emit({
      text: fullContent,
      commandLabel: cmdLabel || undefined,
    });

    this.prompt.reset();
    this.activeCommand.set(null);
    this.isSlashMenuOpen.set(false);
    this.closePlusMenu();
    this.closeModeMenu();
  }

  cancel(): void {
    this.cancelGeneration.emit();
  }
}
