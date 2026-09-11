import { DecimalPipe, UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AiSocketService } from '../../core/ai-socket.service';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { AgentTraceStep, AiActionItem, ChatMessage, ChatSession } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { ToastService } from '../../core/toast.service';

export interface SuggestionItem {
  text: string;
  icon: 'cart' | 'outfit' | 'tshirt' | 'gem' | 'clock';
}

@Component({
  selector: 'app-ai-studio',
  imports: [ReactiveFormsModule, DecimalPipe, UpperCasePipe, RouterLink],
  templateUrl: './ai-studio.component.html',
  styleUrl: './ai-studio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiStudioComponent implements OnInit {
  readonly ai = inject(AiSocketService);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly runtime = inject(RuntimeConfigService);

  @ViewChild('promptTextarea') promptTextarea?: ElementRef<HTMLTextAreaElement>;

  private followLatest = true;
  onConversationScroll(): void {
    const el = this.conversation?.nativeElement;
    if (el) this.followLatest = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  readonly isConfiguratorOpen = signal(false);
  readonly isSessionsOpen = signal(false);
  readonly isToolsMenuOpen = signal(false);
  readonly isPlusMenuOpen = signal(false);
  readonly isModeMenuOpen = signal(false);
  readonly activeModel = signal<'mini' | 'dynamic' | 'gemma'>(this.readStoredModel());
  readonly selectedGarment = signal<AiActionItem | null>(null);
  readonly expandedTraces = signal<Record<string, boolean>>({});
  readonly openThoughts = signal<Set<string>>(new Set());

  readonly activeCommand = signal<string | null>(null);
  readonly isSlashMenuOpen = signal<boolean>(false);

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

  isThinkingOpen(messageId: string): boolean {
    return this.openThoughts().has(messageId);
  }

  toggleThinking(messageId: string): void {
    this.openThoughts.update((set) => {
      const next = new Set(set);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }

  formatUserQuery(message: ChatMessage): string {
    if (!message.isCommand || !message.commandLabel) return message.content;
    const prefix = `/${message.commandLabel}`.toLowerCase();
    if (message.content.toLowerCase().startsWith(prefix)) {
      return message.content.slice(prefix.length).trim();
    }
    return message.content;
  }

  togglePlusMenu(): void {
    this.isPlusMenuOpen.update((v) => !v);
    if (this.isPlusMenuOpen()) {
      this.isModeMenuOpen.set(false);
      this.isToolsMenuOpen.set(false);
    }
  }

  closePlusMenu(): void {
    this.isPlusMenuOpen.set(false);
  }

  toggleModeMenu(): void {
    this.isModeMenuOpen.update((v) => !v);
    if (this.isModeMenuOpen()) {
      this.isPlusMenuOpen.set(false);
      this.isToolsMenuOpen.set(false);
    }
  }

  closeModeMenu(): void {
    this.isModeMenuOpen.set(false);
  }

  selectModel(model: 'mini' | 'dynamic' | 'gemma'): void {
    this.activeModel.set(model);
    this.closeModeMenu();
    try {
      localStorage.setItem('drapemind_altair_model', model);
    } catch {
      // ignore storage error
    }
  }

  private readStoredModel(): 'mini' | 'dynamic' | 'gemma' {
    try {
      const val = localStorage.getItem('drapemind_altair_model');
      if (val === 'mini' || val === 'dynamic' || val === 'gemma') return val;
    } catch {
      // ignore storage error
    }
    return 'dynamic';
  }

  handleNewChat(): void {
    this.ai.createNewSession();
    this.closePlusMenu();
  }

  handleOpenSessions(): void {
    this.closePlusMenu();
    this.isSessionsOpen.set(true);
  }

  handleOpenQuestionnaire(): void {
    this.closePlusMenu();
    this.isConfiguratorOpen.set(true);
  }

  handleOpenCart(): void {
    this.closePlusMenu();
    this.cart.open();
  }

  executeOutfitBuilder(): void {
    this.closePlusMenu();
    this.isConfiguratorOpen.set(true);
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

  readonly availableTools = [
    {
      id: 'search',
      icon: 'search',
      label: 'Buscar prendas',
      desc: 'Por color, ocasión, tipo o precio',
      prompt: 'Busca prendas disponibles para ',
    },
    {
      id: 'outfit',
      icon: 'outfit',
      label: 'Generar outfit',
      desc: 'Combinación completa con presupuesto',
      prompt: 'Arma un outfit elegante con presupuesto de Bs 600',
    },
    {
      id: 'arrivals',
      icon: 'arrivals',
      label: 'Novedades Atelier',
      desc: 'Últimas piezas exclusivas en catálogo',
      prompt: '¿Qué novedades y piezas recién llegadas tienen en el showroom?',
    },
    {
      id: 'advice',
      icon: 'advice',
      label: 'Asesoría de estilo',
      desc: 'Telas, siluetas y combinaciones',
      prompt: 'Explícame qué cortes y telas me favorecen para una ocasión especial',
    },
    {
      id: 'stock',
      icon: 'stock',
      label: 'Consultar stock y tallas',
      desc: 'Disponibilidad real en tienda',
      prompt: '¿Tienen stock y tallas disponibles de ',
    },
  ];

  readonly configForm = new FormGroup({
    occasion: new FormControl('dinamico'),
    topType: new FormControl(''),
    topSize: new FormControl(''),
    bottomType: new FormControl(''),
    bottomSize: new FormControl(''),
    shoeSize: new FormControl(''),
    budget: new FormControl<number | null>(null),
    customDetail: new FormControl(''),
  });

  readonly prompt = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(2000)],
  });

  readonly suggestions: SuggestionItem[] = [
    {
      text: 'Mira mi carrito y dime qué puedo combinar o mejorar en mi elección',
      icon: 'cart',
    },
    {
      text: 'Arma un outfit elegante para una cena con presupuesto de Bs 700',
      icon: 'outfit',
    },
    {
      text: 'Dime 4 poleras bonitas que no superen los 750 Bs',
      icon: 'tshirt',
    },
    {
      text: 'Muestra las piezas más exclusivas y de tendencia del atelier',
      icon: 'gem',
    },
    {
      text: 'Qué hay de nuevo para mí sin repetir lo que ya me mostraste',
      icon: 'gem',
    },
    {
      text: 'Qué reservas tengo activas y cuándo vencen',
      icon: 'clock',
    },
  ];

  @ViewChild('conversation') conversation?: ElementRef<HTMLElement>;

  constructor() {
    this.ai.connect();
    effect(() => {
      this.ai.messages();
      if (this.followLatest) window.setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['autoQuery']) {
        setTimeout(() => this.send(params['autoQuery']), 250);
      }
    });
  }

  toggleConfigurator(): void {
    this.isConfiguratorOpen.update((v) => !v);
  }

  toggleSessions(): void {
    this.isSessionsOpen.update((v) => !v);
  }

  openGarmentDetail(item: AiActionItem): void {
    this.selectedGarment.set(item);
  }

  closeGarmentDetail(): void {
    this.selectedGarment.set(null);
  }

  toggleTrace(messageId: string): void {
    this.expandedTraces.update((traces) => ({
      ...traces,
      [messageId]: !traces[messageId],
    }));
  }

  isTraceExpanded(messageId: string): boolean {
    return !!this.expandedTraces()[messageId];
  }

  submitConfiguredOutfit(): void {
    const vals = this.configForm.value;
    const parts: string[] = [];
    if (vals.occasion && vals.occasion !== 'dinamico') {
      parts.push(`Arma un outfit para ocasión ${vals.occasion}`);
    } else {
      parts.push('Diseña un outfit completo según criterio estético y contexto');
    }

    if (vals.topType && vals.topSize) {
      parts.push(`${vals.topType} en talla ${vals.topSize}`);
    } else if (vals.topType) {
      parts.push(`prenda superior tipo ${vals.topType}`);
    } else if (vals.topSize) {
      parts.push(`talla superior ${vals.topSize}`);
    }

    if (vals.bottomType && vals.bottomSize) {
      parts.push(`${vals.bottomType} en talla ${vals.bottomSize}`);
    } else if (vals.bottomType) {
      parts.push(`prenda inferior tipo ${vals.bottomType}`);
    } else if (vals.bottomSize) {
      parts.push(`pantalón talla ${vals.bottomSize}`);
    }

    if (vals.shoeSize) {
      parts.push(`calzado talla ${vals.shoeSize}`);
    }

    if (vals.budget && vals.budget > 0) {
      parts.push(`presupuesto máximo de Bs ${vals.budget}`);
    }

    if (vals.customDetail?.trim()) {
      parts.push(vals.customDetail.trim());
    }

    this.send(parts.join(', '), {
      isCommand: true,
      commandLabel: 'Diseñar Outfit a Medida',
    });
    this.isConfiguratorOpen.set(false);
  }

  send(value?: string, options?: { isCommand?: boolean; commandLabel?: string }): void {
    const raw = (value ?? this.prompt.value ?? '').trim();
    if (!raw && !this.activeCommand()) return;
    if (this.ai.isBusy()) return;

    const cmdLabel = options?.commandLabel || this.activeCommand();
    const isCmd = options?.isCommand ?? !!cmdLabel;

    let fullContent = raw;
    if (cmdLabel) {
      const prefix = `/${cmdLabel}`.toLowerCase();
      if (!raw.toLowerCase().startsWith(prefix)) {
        fullContent = `/${cmdLabel} ${raw}`.trim();
      }
    }

    this.ai.sendMessage(fullContent, {
      isCommand: isCmd,
      commandLabel: cmdLabel || undefined,
      mode: this.activeModel(),
    });

    this.prompt.reset();
    this.activeCommand.set(null);
    this.isSlashMenuOpen.set(false);
    this.closePlusMenu();
    this.followLatest = true;
    window.setTimeout(() => this.scrollToBottom(), 60);
  }

  toggleToolsMenu(): void {
    this.isToolsMenuOpen.update((v) => !v);
  }

  closeToolsMenu(): void {
    this.isToolsMenuOpen.set(false);
  }

  selectTool(promptText: string): void {
    this.prompt.setValue(promptText);
    this.isToolsMenuOpen.set(false);
  }

  cancel(): void {
    this.ai.cancelGeneration();
  }

  onKeydown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key === 'Enter' && !keyboard.shiftKey) {
      keyboard.preventDefault();
      this.send();
    }
  }

  addToCart(item: AiActionItem): void {
    if (item.accion !== 'AGREGAR' || !item.variante_id) return;
    const variantId = item.variante_id;
    this.cart.addItem(variantId, 1, `Prenda "${item.nombre}" agregada a tu perchero`);
    this.closeGarmentDetail();
  }

  removeFromCart(item: AiActionItem): void {
    if (item.item_id) {
      this.cart.removeItem(item.item_id);
    }
    this.closeGarmentDetail();
  }

  replaceCartWithOutfit(items: AiActionItem[]): void {
    const variants = items
      .filter((item) => item.accion === 'AGREGAR' && item.variante_id)
      .map((item) => ({ variante_id: item.variante_id!, cantidad: 1 }));
    this.cart.replaceWithItems(
      variants,
      `Carrito reemplazado por una selección de ${variants.length} prendas`,
    );
  }

  openCartDrawer(): void {
    this.cart.open();
  }

  statusLabel(): string {
    const labels = {
      offline: 'Estilista Desconectado',
      connecting: 'Estableciendo Conexión',
      connected: 'En línea',
      loading: 'Altair Razonando...',
      ready: 'Personal Stylist Listo',
      error: 'Reintentando Conexión',
    };
    return labels[this.ai.status()] || 'En Espera';
  }

  toolLabel(name: string): string {
    const labels: Record<string, string> = {
      search_products: 'Explorando catálogo del showroom',
      get_product_detail: 'Inspeccionando detalles de prenda',
      get_my_cart: 'Consultando prendas en tu perchero',
      recommend_outfit: 'Diseñando combinación de outfit',
      get_trending_pieces: 'Consultando prendas de alta gama',
      get_new_arrivals: 'Explorando novedades del atelier',
      get_most_expensive_product: 'Seleccionando pieza exclusiva de alto valor',
      get_stock: 'Verificando tallas y disponibilidad',
      find_alternatives: 'Contrastando alternativas de estilo',
      calculate_cart_totals: 'Calculando totales exactos',
      compare_products: 'Analizando relación valor y calidad',
      get_my_orders: 'Verificando compras recientes',
      get_my_reservations: 'Revisando reservas activas en tienda',
      evaluate_garment_fit: 'Evaluando caída y holgura textil',
      analyze_styling: 'Analizando armonía de look',
      prepare_model: 'Preparando Altair AI',
      compose_response: 'Sintetizando dictamen de estilo',
    };
    return labels[name] ?? name;
  }

  formatDuration(durationMs?: number): string {
    if (durationMs === undefined) return '';
    if (durationMs < 1000) return `${durationMs} ms`;
    return `${(durationMs / 1000).toFixed(1)} s`;
  }

  cardImageUrl(item: AiActionItem): string | null {
    if (!item.imagen || item.imagen.includes('placeholder')) return null;
    return this.runtime.resolveImageUrl(item.imagen);
  }

  getGarmentType(name: string): 'top' | 'bottom' | 'shoes' | 'accessory' | 'atelier' {
    const n = (name || '').toLowerCase();
    if (n.includes('polera') || n.includes('camisa') || n.includes('blusa') || n.includes('polo') || n.includes('top') || n.includes('hoodie') || n.includes('chaleco') || n.includes('casaca') || n.includes('remera')) return 'top';
    if (n.includes('pantalon') || n.includes('pantalón') || n.includes('jean') || n.includes('denim') || n.includes('cargo') || n.includes('falda') || n.includes('short') || n.includes('bermuda') || n.includes('palazzo') || n.includes('chino')) return 'bottom';
    if (n.includes('zapato') || n.includes('calzado') || n.includes('sneaker') || n.includes('bota') || n.includes('sandalia') || n.includes('mocasin') || n.includes('mocasín') || n.includes('tacon') || n.includes('tacón')) return 'shoes';
    if (n.includes('accesorio') || n.includes('cinturon') || n.includes('cinturón') || n.includes('cartera') || n.includes('bolso') || n.includes('gorra') || n.includes('joya') || n.includes('reloj') || n.includes('lentes')) return 'accessory';
    return 'atelier';
  }

  getGarmentLabel(name: string): string {
    const type = this.getGarmentType(name);
    const map = {
      top: 'PRENDA SUPERIOR',
      bottom: 'PRENDA INFERIOR',
      shoes: 'CALZADO ATELIER',
      accessory: 'ACCESORIO DE ESTILO',
      atelier: 'PIEZA ATELIER',
    };
    return map[type];
  }

  formatRelativeTime(isoDate: string | Date): string {
    const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return 'Hoy';
  }

  cleanEmoji(text: string): string {
    return text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B06}\u{2194}-\u{21AA}]/gu,
      '',
    );
  }

  parseMarkdown(raw: string): string {
    if (!raw) return '';
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const codeBlocks: string[] = [];
    const cleanText = escape(raw).replace(/```[^\n]*\n([\s\S]*?)(?:```|$)/g, (_, code: string) => {
      const key = `DRAPECODEBLOCK${codeBlocks.length}END`;
      codeBlocks.push(`<pre class="md-code"><code>${code.replace(/\n$/, '')}</code></pre>`);
      return key;
    });
    const lines = cleanText.split('\n');
    const resultLines: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').map((c) => c.trim()).slice(1, -1);
        if (cells.every((c) => /^[-:]+$/.test(c))) {
          continue; // fila separadora |---|---|
        }
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(cells);
      } else {
        if (inTable) {
          resultLines.push(this.buildHtmlTable(tableRows));
          inTable = false;
          tableRows = [];
        }
        resultLines.push(line);
      }
    }
    if (inTable) {
      resultLines.push(this.buildHtmlTable(tableRows));
    }

    let html = resultLines.join('\n');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>');

    // Dividers
    html = html.replace(/^\*\*\*$/gim, '<hr class="md-divider" />');
    html = html.replace(/^---$/gim, '<hr class="md-divider" />');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Lists
    html = html.replace(
      /^\* (.*$)/gim,
      '<div class="md-bullet"><span class="bullet-point"></span><span>$1</span></div>',
    );
    html = html.replace(
      /^- (.*$)/gim,
      '<div class="md-bullet"><span class="bullet-point"></span><span>$1</span></div>',
    );

    // Paragraphs
    html = html.replace(/\n\n+/g, '<br/><br/>');

    return html.replace(/DRAPECODEBLOCK(\d+)END/g, (_, index: string) => codeBlocks[Number(index)] ?? '');
  }

  private buildHtmlTable(rows: string[][]): string {
    if (rows.length === 0) return '';
    const header = rows[0];
    const bodyRows = rows.slice(1);

    let out = '<div class="table-container"><table class="atelier-table"><thead><tr>';
    for (const h of header) {
      out += `<th>${this.formatCell(h)}</th>`;
    }
    out += '</tr></thead><tbody>';
    for (const r of bodyRows) {
      out += '<tr>';
      for (const cell of r) {
        out += `<td>${this.formatCell(cell)}</td>`;
      }
      out += '</tr>';
    }
    out += '</tbody></table></div>';
    return out;
  }

  private formatCell(val: string): string {
    return val.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  private scrollToBottom(): void {
    const element = this.conversation?.nativeElement;
    if (element) {
      const latest = element.querySelector<HTMLElement>('.message:last-child');
      const availableHeight = element.clientHeight - 32;
      if (latest && latest.offsetHeight > availableHeight) {
        element.scrollTop = Math.max(0, latest.offsetTop - 16);
      } else {
        element.scrollTop = element.scrollHeight;
      }
    }
  }
}
