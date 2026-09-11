import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AiSocketService } from '../../core/ai-socket.service';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { AgentTraceStep, AiActionItem, ChatMessage, ChatSession } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { ToastService } from '../../core/toast.service';

import { GarmentCardComponent } from './components/garment-card/garment-card.component';
import { ThinkingDropdownComponent } from './components/thinking-dropdown/thinking-dropdown.component';
import { OutfitReceiptComponent } from './components/outfit-receipt/outfit-receipt.component';
import { ChatComposerComponent, ComposerSubmitEvent } from './components/chat-composer/chat-composer.component';
import { GarmentModalComponent } from './components/garment-modal/garment-modal.component';
import {
  OutfitConfiguratorModalComponent,
  OutfitConfigResult,
} from './components/outfit-configurator-modal/outfit-configurator-modal.component';

@Component({
  selector: 'app-ai-studio',
  standalone: true,
  imports: [
    GarmentCardComponent,
    ThinkingDropdownComponent,
    OutfitReceiptComponent,
    ChatComposerComponent,
    GarmentModalComponent,
    OutfitConfiguratorModalComponent,
  ],
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

  @ViewChild('conversation') conversation?: ElementRef<HTMLElement>;

  private followLatest = true;
  onConversationScroll(): void {
    const el = this.conversation?.nativeElement;
    if (el) this.followLatest = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  readonly isConfiguratorOpen = signal(false);
  readonly isSessionsOpen = signal(false);
  readonly activeModel = signal<'mini' | 'dynamic' | 'gemma'>(this.readStoredModel());
  readonly selectedGarment = signal<AiActionItem | null>(null);
  readonly expandedTraces = signal<Record<string, boolean>>({});
  readonly openThoughts = signal<Set<string>>(new Set());

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

  private readStoredModel(): 'mini' | 'dynamic' | 'gemma' {
    try {
      const val = localStorage.getItem('drapemind_altair_model');
      if (val === 'mini' || val === 'dynamic' || val === 'gemma') return val;
    } catch {
      // ignore storage error
    }
    return 'dynamic';
  }

  selectModel(model: 'mini' | 'dynamic' | 'gemma'): void {
    this.activeModel.set(model);
    try {
      localStorage.setItem('drapemind_altair_model', model);
    } catch {
      // ignore storage error
    }
  }

  handleNewChat(): void {
    this.ai.createNewSession();
  }

  handleOpenSessions(): void {
    this.isSessionsOpen.set(true);
  }

  handleOpenQuestionnaire(): void {
    this.isConfiguratorOpen.set(true);
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

  toggleTrace(messageId: string): void {
    this.expandedTraces.update((traces) => ({
      ...traces,
      [messageId]: !traces[messageId],
    }));
  }

  isTraceExpanded(messageId: string): boolean {
    return !!this.expandedTraces()[messageId];
  }

  formatUserQuery(message: ChatMessage): string {
    if (!message.isCommand || !message.commandLabel) return message.content;
    const prefix = `/${message.commandLabel}`.toLowerCase();
    if (message.content.toLowerCase().startsWith(prefix)) {
      return message.content.slice(prefix.length).trim();
    }
    return message.content;
  }

  send(value: string, options?: { isCommand?: boolean; commandLabel?: string }): void {
    const raw = (value ?? '').trim();
    if (!raw) return;
    if (this.ai.isBusy()) return;

    const cmdLabel = options?.commandLabel;
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

    this.followLatest = true;
    window.setTimeout(() => this.scrollToBottom(), 60);
  }

  onComposerSend(event: ComposerSubmitEvent): void {
    this.send(event.text, {
      isCommand: !!event.commandLabel,
      commandLabel: event.commandLabel,
    });
  }

  onOutfitConfigSubmit(result: OutfitConfigResult): void {
    this.send(result.text, {
      isCommand: true,
      commandLabel: result.commandLabel,
    });
    this.isConfiguratorOpen.set(false);
  }

  cancel(): void {
    this.ai.cancelGeneration();
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
          continue;
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
