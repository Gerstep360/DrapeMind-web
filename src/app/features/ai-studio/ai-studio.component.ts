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

  readonly isConfiguratorOpen = signal(false);
  readonly isSessionsOpen = signal(false);
  readonly selectedGarment = signal<AiActionItem | null>(null);
  readonly expandedTraces = signal<Record<string, boolean>>({});

  readonly configForm = new FormGroup({
    occasion: new FormControl('cena'),
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
      window.setTimeout(() => this.scrollToBottom(), 0);
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
    const occLabel = vals.occasion || 'cena';
    parts.push(`Arma un outfit para ocasión ${occLabel}`);

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

    this.send(parts.join(', '));
    this.isConfiguratorOpen.set(false);
  }

  send(value?: string): void {
    const message = (value ?? this.prompt.value).trim();
    if (!message || this.ai.isBusy()) return;
    this.ai.sendMessage(message);
    this.prompt.reset();
    window.setTimeout(() => this.scrollToBottom(), 60);
  }

  onKeydown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key === 'Enter' && !keyboard.shiftKey) {
      keyboard.preventDefault();
      this.send();
    }
  }

  addToCart(item: AiActionItem): void {
    const variantId = item.variante_id || item.id;
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
      connected: 'Atelier En Línea',
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
    if (!item.imagen) return null;
    if (/^(https?:|data:|blob:)/.test(item.imagen)) return item.imagen;
    const path = item.imagen.startsWith('/') ? item.imagen : `/${item.imagen}`;
    return `${this.runtime.backendUrl}${path}`;
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
    const cleanText = this.cleanEmoji(raw);
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

    return html;
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
