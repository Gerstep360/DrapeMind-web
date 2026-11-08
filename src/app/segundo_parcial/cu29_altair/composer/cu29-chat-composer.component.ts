import { VoiceInputService } from '../../compartido/voice-input.service';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../core/toast.service';
import { ComposerSubmitEvent } from '../../../shared/components/altair/altair-component.models';

@Component({
  selector: 'app-chat-composer',
  providers: [VoiceInputService],
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './cu29-chat-composer.component.html',
  styleUrl: './cu29-chat-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComposerComponent implements OnChanges, OnDestroy {
  private readonly toast = inject(ToastService);

  @Input() disabled = false;
  @Input() isBusy = false;

  @Output() sendMessage = new EventEmitter<ComposerSubmitEvent>();
  @Output() cancelGeneration = new EventEmitter<void>();
  @Output() openOutfitBuilder = new EventEmitter<void>();
  @Output() openShoppingSetup = new EventEmitter<string>();

  @ViewChild('promptTextarea') promptTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly prompt = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly activeCommand = signal<string | null>(null);
  readonly isPlusMenuOpen = signal(false);
  readonly isModeMenuOpen = signal(false);
  readonly isSlashMenuOpen = signal(false);
  readonly voice=inject(VoiceInputService);
  readonly isListening=this.voice.listening;



  ngOnChanges(): void {
    if (this.disabled || this.isBusy) this.prompt.disable({ emitEvent: false });
    else this.prompt.enable({ emitEvent: false });
  }

  ngOnDestroy(): void { this.voice.cancel(); }

  readonly slashCommands = [
    {
      label: 'Para mí',
      desc: 'Prendas según mis tallas y gustos',
      template:
        'Busca prendas para mí usando mis preferencias y tallas guardadas. Explica las coincidencias y avisa si falta confirmar algo.',
    },
    {
      label: 'Novedades para mí',
      desc: 'Ingresos recientes que encajan conmigo',
      template:
        'Consulta novedades reales de los últimos 30 días que puedan interesarme según mi perfil. Evita repetir las prendas que ya vimos.',
    },
    {
      label: 'Mi sucursal',
      desc: 'Dónde reunir mi selección',
      template: 'Compara sucursales para mi carrito con stock real y mi ciudad.',
    },
    {
      label: 'Más por mi presupuesto',
      desc: 'Más prendas dentro de mi límite',
      template: 'Calcula más prendas dentro de mi presupuesto, respetando mis tallas y gustos.',
    },
    {
      label: 'Ahorrar en mi carrito',
      desc: 'Alternativas y extras con el ahorro',
      template:
        'Busca alternativas más baratas para mi carrito manteniendo tallas, colores y cantidades. Calcula el ahorro real y si puedo llevar alguna prenda extra sin superar el total actual. Muéstrame la propuesta antes de cambiar nada.',
    },
    {
      label: 'Mi presupuesto',
      desc: 'Recomienda outfit por presupuesto máximo en Bs',
      template: 'Crea un look con mis preferencias y mi presupuesto.',
    },
    {
      label: 'Combinar mi carrito',
      desc: 'Revisa prendas del perchero y sugiere combinaciones',
      template: 'Revisa mi carrito y ayúdame a combinar sus prendas.',
    },
    {
      label: 'Buscar prendas',
      desc: 'Descubre piezas exclusivas y novedades',
      template: 'Busca prendas según mis criterios confirmados.',
    },
    {
      label: 'Armar un look',
      desc: 'Diseña un look completo según criterio estético y ocasión',
      template:
        'Diseña un outfit completo para una ocasión casual elegante con piezas del showroom.',
    },
  ];

  clearActiveCommand(): void {
    this.activeCommand.set(null);
  }

  selectShoppingTool(index: number): void {
    this.closePlusMenu();
    this.openShoppingSetup.emit(
      ['discover', 'new_arrivals', 'branches', 'budget', 'savings'][index],
    );
  }

  selectSlashCommand(cmd: { label: string; desc: string; template: string }): void {
    this.activeCommand.set(cmd.label);
    this.prompt.setValue(cmd.template);
    this.isSlashMenuOpen.set(false);
    this.focusPrompt();
  }

  onInputChange(): void {
    const field = this.promptTextarea?.nativeElement;
    if (field) {
      field.style.height = 'auto';
      field.style.height = `${Math.min(180, field.scrollHeight)}px`;
    }
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
    this.isSlashMenuOpen.set(false);
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

  executeOutfitBuilder(): void {
    this.closePlusMenu();
    this.openShoppingSetup.emit('outfit');
  }

  executeClosetAnalysis(): void {
    this.closePlusMenu();
    this.activeCommand.set('Combinar mi carrito');
    this.prompt.setValue('Revisa mi carrito y ayúdame a combinar sus prendas.');
    this.focusPrompt();
  }

  executeBudgetLook(): void {
    this.closePlusMenu();
    this.openShoppingSetup.emit('budget');
  }

  executeCatalogExplore(): void {
    this.closePlusMenu();
    this.openShoppingSetup.emit('discover');
  }

  toggleVoiceRecognition(): void {
    if(this.voice.listening()){void this.voice.stop();return;}
    if(this.isBusy||this.disabled||this.voice.processing())return;
    void this.voice.start('ALTAIR',text=>{this.prompt.setValue([this.prompt.value.trim(),text].filter(Boolean).join(' ').slice(0,2000));this.focusPrompt();},error=>this.toast.show(error.message,'error'));
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
    if (this.isBusy || this.disabled || this.voice.processing() || this.voice.listening()) return;

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
