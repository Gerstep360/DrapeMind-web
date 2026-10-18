import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  effect,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AiDataBlock, readAiDataBlocks } from '@core/models/ai-presentation.models';
import { CatalogApiService } from '@core/api/catalog-api.service';
import { AiSocketService } from '@core/ai-socket.service';
import { AuthService } from '@core/auth.service';
import { CartService } from '@core/cart.service';
import { AgentTraceStep, AiActionItem, ChatMessage, ChatSession } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { ToastService } from '@core/toast.service';

import { GarmentCardComponent } from '@shared/components/altair/garment-card/garment-card.component';
import { AiPresentationComponent } from '@shared/components/altair/ai-presentation/ai-presentation.component';
import { OutfitReceiptComponent } from '@shared/components/altair/outfit-receipt/outfit-receipt.component';
import { ToolActivityComponent } from '@shared/components/altair/tool-activity/tool-activity.component';
import { ChatComposerComponent } from '@shared/components/altair/chat-composer/chat-composer.component';
import { GarmentModalComponent } from '@shared/components/altair/garment-modal/garment-modal.component';
import { OutfitConfiguratorModalComponent } from '@shared/components/altair/outfit-configurator-modal/outfit-configurator-modal.component';
import {
  ComposerSubmitEvent,
  OutfitConfigResult,
} from '@shared/components/altair/altair-component.models';

@Component({
  selector: 'app-ai-studio',
  standalone: true,
  imports: [
    GarmentCardComponent,
    AiPresentationComponent,
    ToolActivityComponent,

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
  private readonly catalog = inject(CatalogApiService);
  private readonly router = inject(Router);
  private detailRequest = 0;
  private readonly http = inject(HttpClient);
  readonly shoppingSetup = signal<AiDataBlock[]>([]);
  readonly setupLoading = signal(false);
  readonly setupOwner = signal('');
  private setupVersion = 0;

  openShoppingSetup(goal: string): void {
    const version = ++this.setupVersion;
    const session = this.ai.activeSessionId();
    this.setupOwner.set(session);
    const backendSession = this.ai.currentSession().backendSessionId;
    this.setupLoading.set(true);
    this.shoppingSetup.set([]);
    this.http
      .get<unknown>(`${this.runtime.apiUrl}/ai/shopping-setup`, {
        params: backendSession ? { goal, session_id: backendSession } : { goal },
      })
      .subscribe({
        next: (block) => {
          if (version !== this.setupVersion || session !== this.ai.activeSessionId()) return;
          this.shoppingSetup.set(readAiDataBlocks([block]));
          this.setupLoading.set(false);
          this.followLatest = true;
          setTimeout(() => this.scrollToBottom(), 50);
        },
        error: () => {
          if (version === this.setupVersion) {
            this.setupLoading.set(false);
            this.toast.show(
              'No pude cargar tus preferencias. Reintenta desde Herramientas.',
              'error',
            );
          }
        },
      });
  }

  closeShoppingSetup(): void {
    ++this.setupVersion;
    this.shoppingSetup.set([]);
    this.setupLoading.set(false);
  }
  submitShoppingSetup(message: string): void {
    if (!this.ai.canSend()) return;
    this.closeShoppingSetup();
    this.send(message);
  }

  @ViewChild('conversation') conversation?: ElementRef<HTMLElement>;

  private followLatest = true;
  private scrollFrame: number | null = null;
  onConversationScroll(): void {
    const el = this.conversation?.nativeElement;
    if (el) this.followLatest = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  readonly isConfiguratorOpen = signal(false);
  readonly isSessionsOpen = signal(false);
  readonly selectedGarment = signal<AiActionItem | null>(null);
  readonly expandedTraces = signal<Record<string, boolean>>({});
  readonly openThoughts = signal<Set<string>>(new Set());

  constructor() {
    this.ai.connect();
    inject(DestroyRef).onDestroy(() => {
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    });
    effect(() => {
      this.ai.messages();
      if (this.followLatest && this.scrollFrame === null) {
        this.scrollFrame = window.requestAnimationFrame(() => {
          this.scrollFrame = null;
          this.scrollToBottom();
        });
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['openConfigurator'] === 'true') {
        this.isConfiguratorOpen.set(true);
      }
      if (params['autoQuery']) {
        setTimeout(() => this.send(params['autoQuery'], { context: params['context'] }), 250);
      }
    });
  }

  handleNewChat(): void {
    this.closeShoppingSetup();
    this.ai.createNewSession();
  }

  async copyMessage(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      this.toast.show('Respuesta copiada', 'success');
    } catch {
      this.toast.show('No se pudo copiar. Puedes seleccionar el texto de la respuesta.', 'info');
    }
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
    if (item.accion === 'VER_PEDIDO' || item.accion === 'VER_RESERVA') {
      void this.router.navigate([item.accion === 'VER_PEDIDO' ? '/orders' : '/reservations']);
      return;
    }
    const request = ++this.detailRequest;
    this.selectedGarment.set(null);
    this.catalog.product(item.id).subscribe({
      next: (product) => {
        if (request !== this.detailRequest) return;
        const variant = product.variantes?.find((row) => row.id === item.variante_id && row.activo);
        if (!variant) {
          this.toast.show(
            'Esta variante ya no está disponible. Puedes elegir otra desde el catálogo.',
            'info',
          );
          return;
        }
        this.selectedGarment.set({
          ...item,
          nombre: product.nombre,
          precio: product.precio,
          talla: variant.talla,
          color: variant.color,
          sku: variant.sku,
          imagen: variant.imagen || item.imagen,
          stock_disponible: variant.stock_disponible,
        });
      },
      error: () => {
        if (request === this.detailRequest)
          this.toast.show('No pude consultar los datos actuales de la prenda. Reintenta.', 'error');
      },
    });
  }

  closeGarmentDetail(): void {
    this.detailRequest++;
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

  send(
    value: string,
    options?: { isCommand?: boolean; commandLabel?: string; context?: string },
  ): void {
    const raw = (value ?? '').trim();
    if (!raw) return;
    if (!this.ai.canSend()) return;

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

      context: options?.context,
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
    if (
      !window.confirm('Esta selección reemplazará las prendas actuales de tu perchero. ¿Continuar?')
    )
      return;
    const variants = items
      .filter((item) => item.accion === 'AGREGAR' && item.variante_id)
      .map((item) => ({ variante_id: item.variante_id!, cantidad: 1 }));
    this.cart.replaceWithItems(
      variants,
      `Carrito reemplazado por una selección de ${variants.length} prendas`,
      true,
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
      evaluate_garment_fit: 'Comprobando datos para evaluar ajuste',
      ask_shopping_preferences: 'Preparando las opciones para ti',
      get_my_shopping_context: 'Consultando tus preferencias',
      discover_for_me: 'Buscando prendas para ti',
      recommend_pickup_branches: 'Comparando stock entre sucursales',
      plan_more_for_less: 'Calculando más prendas por tu presupuesto',
      find_cart_savings: 'Buscando ahorro real en tu carrito',
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
    const escape = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .slice(1, -1);
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

    return html.replace(
      /DRAPECODEBLOCK(\d+)END/g,
      (_, index: string) => codeBlocks[Number(index)] ?? '',
    );
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
      element.scrollTop = element.scrollHeight;
    }
  }
}
