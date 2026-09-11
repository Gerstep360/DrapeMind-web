import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { AgentTraceStep, AiPresentationMode, AiSocketEvent, ChatMessage, ChatSession } from './models';
import { RuntimeConfigService } from './runtime-config.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from './toast.service';

export type SocketStatus = 'offline' | 'connecting' | 'connected' | 'loading' | 'ready' | 'error';

function generateSafeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback si falla el contexto del navegador
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

@Injectable({ providedIn: 'root' })
export class AiSocketService {
  private static readonly STORAGE_KEY = 'drapemind_ai_sessions_v2';
  private static readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 Horas

  private readonly auth = inject(AuthService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private remoteBusy = false;
  private storageOwner: number | null = null;
  private get storageKey(): string {
    return AiSocketService.STORAGE_KEY + ':' + this.runtime.apiUrl + ':' + this.storageOwner;
  }

  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private heartbeat: number | null = null;
  private tickerTimer: number | null = null;
  private queuedMessage: { content: string; mode?: 'mini' | 'dynamic' | 'gemma' } | null = null;
  private responseStartedAt = 0;
  private authRejected = false;
  private manualDisconnect = false;

  readonly status = signal<SocketStatus>('offline');
  readonly sessions = signal<ChatSession[]>([]);
  readonly activeSessionId = signal<string>('');
  readonly toolActivity = signal<AgentTraceStep[]>([]);
  readonly liveThoughtSteps = signal<string[]>([]);
  readonly currentThought = signal<string | null>(null);
  readonly thinkingElapsedMs = signal<number>(0);

  readonly thinkingElapsedFormatted = computed(() => {
    return `${(this.thinkingElapsedMs() / 1000).toFixed(1)}s`;
  });

  readonly currentSession = computed<ChatSession>(() => {
    const list = this.sessions();
    const activeId = this.activeSessionId();
    const found = list.find((s) => s.id === activeId);
    if (found) return found;
    if (list.length > 0) return list[0];
    return {
      id: 'default-session',
      title: 'Asesoría Atelier',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
  });

  readonly messages = computed<ChatMessage[]>(() => {
    return this.currentSession().messages;
  });

  readonly isBusy = computed(() => {
    return this.currentSession().messages.some((message) => message.pending);
  });

  constructor() {
    effect(() => {
      const owner = this.auth.user()?.id ?? null;
      untracked(() => {
        if (owner === this.storageOwner) return;
        const reconnect = this.socket !== null;
        this.disconnect();
        this.queuedMessage = null;
        this.sessions.set([]);
        this.activeSessionId.set('');
        this.storageOwner = owner;
        if (owner !== null) {
          this.loadSessionsFromStorage();
          if (reconnect) this.connect();
        }
      });
    });
  }

  // --- MULTI-SESSION 24H STORAGE ---
  private loadSessionsFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[];
        const now = Date.now();
        // Filtrar sesiones vencidas (>24h)
        const valid = parsed.filter((s) => {
          const updatedTime = new Date(s.updatedAt || s.createdAt).getTime();
          return now - updatedTime < AiSocketService.TTL_MS;
        });

        if (valid.length > 0) {
          // Restoring a snapshot does not restore its WebSocket request.
          this.sessions.set(valid.map((session) => ({
            ...session,
            messages: session.messages.map((message) => message.pending ? {
              ...message, pending: false, error: true,
              content: (message.content || '') + '\n\nLa conexión anterior se interrumpió. Puedes enviar tu consulta de nuevo.',
            } : message),
          })));
          this.saveSessionsToStorage();
          this.activeSessionId.set(valid[0].id);
          return;
        }
      }
    } catch {
      // Ignorar error de parsing y arrancar fresco
    }

    // Inicializar sesión por defecto
    const initialSession: ChatSession = {
      id: generateSafeUuid(),
      title: 'Asesoría Atelier',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.sessions.set([initialSession]);
    this.activeSessionId.set(initialSession.id);
    this.saveSessionsToStorage();
  }

  private saveSessionsToStorage(): void {
    try {
      const now = Date.now();
      const valid = this.sessions().filter((s) => {
        const updatedTime = new Date(s.updatedAt || s.createdAt).getTime();
        return now - updatedTime < AiSocketService.TTL_MS;
      });
      if (this.storageOwner !== null) localStorage.setItem(this.storageKey, JSON.stringify(valid));
    } catch {
      // localStorage no disponible o quota excedida
    }
  }

  createNewSession(title?: string): void {
    if (this.isBusy() || this.remoteBusy) return;
    const newSession: ChatSession = {
      id: generateSafeUuid(),
      title: title ?? `Conversación #${this.sessions().length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.sessions.update((list) => [newSession, ...list]);
    this.activeSessionId.set(newSession.id);
    this.toolActivity.set([]);
    this.liveThoughtSteps.set([]);
    this.currentThought.set(null);
    this.saveSessionsToStorage();
  }

  switchSession(sessionId: string): void {
    if (this.isBusy() || this.remoteBusy) return;
    if (this.activeSessionId() === sessionId) return;
    if (this.sessions().some((s) => s.id === sessionId)) {
      this.activeSessionId.set(sessionId);
      this.toolActivity.set([]);
      this.liveThoughtSteps.set([]);
      this.currentThought.set(null);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.isBusy() || this.remoteBusy) return;
    const session = this.sessions().find(item => item.id === sessionId);
    if (!await this.deleteRemote(session?.backendSessionId)) return;
    this.sessions.update((list) => list.filter((s) => s.id !== sessionId));
    if (this.sessions().length === 0) {
      this.createNewSession('Nueva Conversación');
    } else if (this.activeSessionId() === sessionId) {
      this.activeSessionId.set(this.sessions()[0].id);
    }
    this.saveSessionsToStorage();
  }

  async clearConversation(): Promise<void> {
    if (this.isBusy() || this.remoteBusy) return;
    if (!await this.deleteRemote(this.currentSession().backendSessionId)) return;
    const activeId = this.activeSessionId();
    this.sessions.update((list) =>
      list.map((s) =>
        s.id === activeId
          ? {
              ...s,
              backendSessionId: null,
              updatedAt: new Date().toISOString(),
              messages: [],
            }
          : s,
      ),
    );
    this.toolActivity.set([]);
    this.liveThoughtSteps.set([]);
    this.currentThought.set(null);
    this.responseStartedAt = 0;
    this.saveSessionsToStorage();
  }

  // --- WEBSOCKET CONNECTION ---
  private async deleteRemote(id?: number | null): Promise<boolean> {
    if (!id) return true;
    this.remoteBusy = true;
    try {
      await firstValueFrom(this.http.delete(this.runtime.apiUrl + '/ai/sessions/' + id));
      return true;
    } catch (error: any) {
      if (error?.status === 404) return true;
      this.toast.show('No se pudo eliminar el chat del servidor. Reintenta al finalizar la consulta.', 'error');
      return false;
    } finally { this.remoteBusy = false; }
  }

  async selectProduct(id: number): Promise<void> {
    if (this.isBusy() || this.remoteBusy) return;
    const chat = this.currentSession();
    if (!chat.backendSessionId) return;
    this.remoteBusy = true;
    try {
      const result = await firstValueFrom(this.http.post<{followup: string}>(
        this.runtime.apiUrl + '/ai/sessions/' + chat.backendSessionId + '/selection', {product_id: id}));
      if (this.activeSessionId() === chat.id) this.sendMessage(result.followup);
    } catch {
      this.toast.show('Esta opción ya no está disponible en el chat. Consulta de nuevo.', 'error');
    } finally { this.remoteBusy = false; }
  }

  connect(): void {
    const token = this.auth.hasValidToken() ? this.auth.token() : null;
    if (
      !token ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    this.clearReconnect();
    this.manualDisconnect = false;
    this.authRejected = false;
    this.status.set('connecting');
    this.socket = new WebSocket(this.runtime.wsUrl('ai'));
    const connection = this.socket;

    this.socket.onopen = () => {
      if (this.socket !== connection) return;
      this.socket?.send(JSON.stringify({ type: 'auth', token }));
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      if (this.socket !== connection) return;
      try {
        const data = JSON.parse(String(event.data)) as AiSocketEvent;
        if (data.code === 'AUTH_INVALID' && this.auth.token() !== token) {
          this.disconnect();
          this.connect();
          return;
        }
        this.handleEvent(data);
      } catch {
        // Ignorar evento no JSON
      }
    };

    this.socket.onerror = (err) => {
      if (this.socket !== connection) return;
      console.error('[Altair WebSocket Error]', err);
      this.status.set('error');
      this.stopThinkingTicker();
      this.updateLastMessage(this.activeSessionId(), (last) => {
        if (last.pending) {
          return {
            ...last,
            pending: false,
            error: true,
            content: last.content || 'Error de red en canal WebSocket (conexión rechazada o caída de red).',
            durationMs: Math.max(0, Date.now() - this.responseStartedAt),
          };
        }
        return last;
      });
    };

    this.socket.onclose = (event) => {
      if (this.socket !== connection) return;
      if (event.code === 4401 && this.auth.token() !== token) {
        this.socket = null;
        this.stopHeartbeat();
        this.connect();
        return;
      }
      this.socket = null;
      this.stopHeartbeat();
      this.stopThinkingTicker();

      let errorMsg = '';
      if (event.code === 4401) {
        errorMsg = 'Sesión expirada o token inválido (Código 4401). Vuelve a iniciar sesión.';
      } else if (event.code === 4403) {
        errorMsg = `Acceso denegado por CORS (Código 4403: ${event.reason || 'Origin no permitido'}).`;
      } else if (event.code === 1006) {
        errorMsg = 'Conexión WebSocket cerrada inesperadamente (Código 1006: Timeout del proxy Nginx o socket reiniciado).';
      } else if (event.code === 1000) {
        errorMsg = event.reason ? `Conexión cerrada: ${event.reason}` : 'Conexión finalizada normalmente.';
      } else {
        errorMsg = `Conexión cerrada (Código ${event.code}${event.reason ? ': ' + event.reason : ''}).`;
      }

      this.updateLastMessage(this.activeSessionId(), (last) => {
        if (last.pending) {
          return {
            ...last,
            pending: false,
            error: true,
            content: last.content ? `${last.content}\n\n[${errorMsg}]` : errorMsg,
            durationMs: Math.max(0, Date.now() - this.responseStartedAt),
          };
        }
        return last;
      });
      if (this.authRejected || event.code === 4401) {
        this.clearReconnect();
        this.queuedMessage = null;
        this.status.set('offline');
        if (this.auth.token()) this.auth.logout();
        return;
      }
      if (!this.manualDisconnect && this.auth.hasValidToken()) {
        this.status.set('offline');
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.queuedMessage = null;
    this.sessions.update((sessions) => sessions.map((session) => ({
      ...session,
      messages: session.messages.map((message) => message.pending ? {
        ...message, pending: false, error: true,
        content: (message.content || '') + '\n\nRespuesta interrumpida al cerrar la conexión.',
      } : message),
    })));
    this.saveSessionsToStorage();
    this.manualDisconnect = true;
    this.clearReconnect();
    this.stopHeartbeat();
    this.stopThinkingTicker();
    this.socket?.close(1000, 'logout');
    this.socket = null;
    this.status.set('offline');
  }

  cancelGeneration(): void {
    if (!this.isBusy()) return;

    this.stopThinkingTicker();
    this.queuedMessage = null;

    const activeId = this.activeSessionId();
    this.sessions.update((list) =>
      list.map((s) => {
        if (s.id !== activeId) return s;
        return {
          ...s,
          messages: s.messages.map((m) =>
            m.pending
              ? {
                  ...m,
                  pending: false,
                  content: m.content
                    ? `${m.content}\n\n*[Respuesta detenida]*`
                    : '*Consulta cancelada por el usuario.*',
                  durationMs: Math.max(0, Date.now() - this.responseStartedAt),
                }
              : m,
          ),
        };
      }),
    );

    this.toolActivity.set([]);
    this.liveThoughtSteps.set([]);
    this.currentThought.set(null);
    this.responseStartedAt = 0;
    this.thinkingElapsedMs.set(0);

    // Interrumpir la conexión para cancelar la tarea en el backend y reconectar
    if (this.socket) {
      this.socket.close(1000, 'cancelled_by_user');
      this.socket = null;
    }
    this.saveSessionsToStorage();
    setTimeout(() => {
      this.connect();
    }, 150);
  }

  sendMessage(
    content: string,
    options?: { isCommand?: boolean; commandLabel?: string; mode?: 'mini' | 'dynamic' | 'gemma' },
  ): void {
    const clean = content;
    if (!clean.trim() || this.isBusy()) return;

    let isCommand = options?.isCommand ?? false;
    let commandLabel = options?.commandLabel;
    if (!isCommand && clean.startsWith('/')) {
      const match = clean.match(/^\/([^\s\[\]\n]+(?:\s+[^\s\[\]\n]+)*)(.*)/);
      if (match && match[1]) {
        isCommand = true;
        commandLabel = match[1].trim();
      }
    }

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const activeId = this.activeSessionId();

    this.sessions.update((list) =>
      list.map((s) => {
        if (s.id !== activeId) return s;
        // Auto nombrar el título de la conversación si es el primer mensaje
        let title = s.title;
        if (s.messages.length <= 1) {
          title = clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
        }
        return {
          ...s,
          title,
          updatedAt: new Date().toISOString(),
          messages: [
            ...s.messages,
            {
              id: userMsgId,
              role: 'user',
              content: clean,
              isCommand,
              commandLabel,
              modelMode: options?.mode,
              createdAt: new Date(),
            },
            {
              id: assistantMsgId,
              role: 'assistant',
              content: '',
              pending: true,
              createdAt: new Date(),
            },
          ],
        };
      }),
    );

    this.toolActivity.set([]);
    this.liveThoughtSteps.set([]);
    this.currentThought.set('Analizando solicitud...');
    this.responseStartedAt = Date.now();
    this.thinkingElapsedMs.set(0);

    this.startThinkingTicker();
    this.saveSessionsToStorage();

    if (
      this.socket?.readyState === WebSocket.OPEN &&
      ['connected', 'ready'].includes(this.status())
    ) {
      this.sendChat(clean, options?.mode);
    } else {
      this.queuedMessage = { content: clean, mode: options?.mode };
      this.connect();
    }
  }

  private startThinkingTicker(): void {
    this.stopThinkingTicker();
    this.tickerTimer = window.setInterval(() => {
      if (this.responseStartedAt > 0) {
        this.thinkingElapsedMs.set(Date.now() - this.responseStartedAt);
      }
    }, 1000);
  }

  private stopThinkingTicker(): void {
    if (this.tickerTimer !== null) {
      window.clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }

  private sendChat(content: string, mode: string = 'dynamic'): void {
    const backendSessionId = this.currentSession().backendSessionId;
    this.socket?.send(
      JSON.stringify({
        type: 'chat',
        message: content,
        session_id: backendSessionId,
        mode: mode || 'dynamic',
      }),
    );
  }

  private handleEvent(event: AiSocketEvent): void {
    const activeId = this.activeSessionId();

    if (event.type === 'connected') {
      this.reconnectAttempt = 0;
      this.status.set('connected');
      if (this.queuedMessage) {
        const item = this.queuedMessage;
        this.queuedMessage = null;
        this.sendChat(item.content, item.mode);
      }
      return;
    }

    if (event.type === 'thought' || event.type === 'progress') {
      const text = event.content || event.text || '';
      if (text) {
        this.currentThought.set(text);
        // Waiting is not an executed or verified tool action.
      }
      return;
    }

    if (event.type === 'model_status') {
      this.status.set(event.status === 'loading' ? 'loading' : 'ready');
      if (event.session_id) {
        this.updateSessionBackendId(activeId, event.session_id);
      }
      const isMini = event.mode === 'mini' || event.model_role === 'scout';
      this.currentThought.set(
        event.status === 'loading'
          ? (isMini ? 'Preparando Altair Mini…' : 'Preparando Altair…')
          : (isMini ? 'Pensando con Altair Mini…' : 'Pensando…')
      );
      return;
    }

    if (event.type === 'tool_start' && event.name) {
      const formatted = event.label || this.formatToolName(event.name);
      this.currentThought.set(formatted);
      this.startTrace(formatted);
      return;
    }

    if (event.type === 'tool_result' && event.name) {
      const formatted = event.label || this.formatToolName(event.name);
      const failed = !!(event.result && typeof event.result === 'object' && 'error' in event.result);
      this.finishTrace(formatted, failed ? 'La consulta devolvió un error' : this.resultSummary(event.result), failed);
      return;
    }

    if (event.type === 'results') {
      this.updateLastMessage(activeId, (last) => ({ ...last, actionItems: event.action_items || [] }));
      return;
    }

    if (event.type === 'presentation') {
      this.updateLastMessage(activeId, (last) => ({
        ...last,
        presentationMode: (event.mode as AiPresentationMode) || event.presentation_mode || last.presentationMode,
        responseTitle: event.title || event.response_title || last.responseTitle,
        notices: event.notices || last.notices,
        responseMeta: event.response_meta || last.responseMeta,
        suggestedActions: event.suggested_actions || last.suggestedActions,
      }));
      return;
    }

    if (event.type === 'answer_snapshot') {
      this.updateLastMessage(activeId, (last) => ({ ...last, content: event.content || '' }));
      return;
    }

    if (event.type === 'token' && event.content) {
      this.updateLastMessage(activeId, (last) => ({
        ...last,
        content: last.content + event.content,
      }));
      return;
    }

    if (event.type === 'done') {
      this.stopThinkingTicker();
      // Only real tools belong in the action history.
      if (event.session_id) {
        this.updateSessionBackendId(activeId, event.session_id);
      }
      this.status.set('ready');
      this.currentThought.set(null);

      const trace = this.toolActivity().map((step) => ({ ...step }));
      const duration = event.duration_ms ?? Math.max(0, Date.now() - this.responseStartedAt);

      this.updateLastMessage(activeId, (last) => ({
        ...last,
        pending: false,
        tools: event.tools || last.tools,
        actionItems: event.action_items || last.actionItems,
        trace,
        presentationMode: event.presentation_mode || last.presentationMode,
        responseTitle: event.response_title || last.responseTitle,
        notices: event.notices || last.notices,
        responseMeta: event.response_meta || last.responseMeta,
        suggestedActions: event.suggested_actions || last.suggestedActions,
        durationMs: duration,
        thoughtSteps: [...this.liveThoughtSteps()],
        thinkingTime: `${(duration / 1000).toFixed(1)}s`,
      }));
      this.saveSessionsToStorage();
      return;
    }

    if (event.type === 'error') {
      if (event.code === 'CHAT_NOT_FOUND') {
        this.sessions.update((list) => list.map((session) =>
          session.id === activeId ? { ...session, backendSessionId: null } : session));
        this.toast.show('Este chat ya no existe en el servidor. La próxima consulta iniciará un contexto nuevo.', 'error');
      }
      this.stopThinkingTicker();
      this.status.set('error');
      this.currentThought.set(null);

      const trace = this.toolActivity().map((step) =>
        step.state === 'running'
? { ...step, state: 'error' as const, summary: 'Proceso interrumpido' }
          : { ...step },
      );

      const errorMsg = event.message || (event as any).detail || 'No se pudo completar la consulta.';
      const codeMsg = event.code ? ` (${event.code})` : '';

      this.updateLastMessage(activeId, (last) =>
        last.pending
          ? {
              ...last,
              content: `**[Error de Altair AI]**${codeMsg}: ${errorMsg}`,
              actionItems: [],
              pending: false,
              error: true,
              trace,
              durationMs: Math.max(0, Date.now() - this.responseStartedAt),
            }
          : last,
      );
      if (
        event.code === 'AUTH_INVALID' ||
        /sesión inválida|sesion invalida|token.*expir|usuario inactivo/i.test(event.message ?? '')
      ) {
        this.authRejected = true;
        this.clearReconnect();
        this.queuedMessage = null;
        this.socket?.close(4401, 'auth_expired');
        this.auth.logout();
      }
      this.saveSessionsToStorage();
    }
  }

  private updateLastMessage(
    sessionId: string,
    updater: (last: ChatMessage) => ChatMessage,
  ): void {
    this.sessions.update((list) =>
      list.map((s) => {
        if (s.id !== sessionId || s.messages.length === 0) return s;
        const copy = [...s.messages];
        const lastIdx = copy.length - 1;
        if (copy[lastIdx].role === 'assistant') {
          copy[lastIdx] = updater(copy[lastIdx]);
        }
        return { ...s, updatedAt: new Date().toISOString(), messages: copy };
      }),
    );
  }

  private updateSessionBackendId(sessionId: string, backendSessionId: number): void {
    this.sessions.update((list) =>
      list.map((s) => (s.id === sessionId ? { ...s, backendSessionId } : s)),
    );
  }

  private formatToolName(name: string): string {
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
    return labels[name] || `Ejecutando ${name.replace(/_/g, ' ')}`;
  }

  private resultSummary(result: unknown): string {
    if (Array.isArray(result)) return `${result.length} ítems verificados`;
    if (result && typeof result === 'object') return 'Datos confirmados';
    return 'Completado';
  }

  private startTrace(name: string): void {
    if (this.toolActivity().some((step) => step.name === name)) return;
    this.toolActivity.update((steps) => [
      ...steps,
      { name, state: 'running', startedAt: Date.now() },
    ]);
  }

  private finishTrace(name: string, summary: string, failed = false): void {
    const now = Date.now();
    this.toolActivity.update((steps) =>
      steps.map((step) =>
        step.name === name && step.state === 'running'
          ? {
              ...step,
              state: failed ? 'error' : 'done',
              summary,
              durationMs: Math.max(0, now - step.startedAt),
            }
          : step,
      ),
    );
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    if (!this.auth.hasValidToken()) return;
    if (this.reconnectAttempt >= 5) {
      this.status.set('error');
      return;
    }
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt++);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}
