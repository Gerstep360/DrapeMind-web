import { AiDataBlock } from './ai-presentation.models';
export type AiModelMode = 'nvidia';

export interface AiRuntimeStatus {
  provider: 'nvidia';
  configured: boolean;
  healthy: boolean;
  model: string;
}

export interface AiActionItem {
  id: number;
  variante_id?: number;
  nombre: string;
  precio: number;
  color?: string;
  talla?: string;
  sku?: string;
  imagen?: string | null;
  accion: 'AGREGAR' | 'QUITAR' | 'REEMPLAZAR' | 'VER_PEDIDO' | 'VER_RESERVA';
  item_id?: number;
  motivo?: string;
  stock_disponible?: number;
}

export type AiPresentationMode = 'text' | 'cards' | 'mixed';

export interface AiNotice {
  type: 'info' | 'warning';
  title: string;
  message: string;
}

export interface AiResponseMeta {
  product_picker?: Array<{ type: 'product'; id: number; label: string }>;
  kind?: 'outfit' | 'catalog' | 'orders' | string;
  total_bob?: number;
  budget_bob?: number | null;
  budget_remaining_bob?: number | null;
  item_count?: number;
  occasion?: string;
  can_add_all?: boolean;
}

export interface AiSuggestedAction {
  label: string;
  prompt: string;
}

export interface AgentTraceStep {
  name: string;
  state: 'running' | 'done' | 'error';
  summary?: string;
  startedAt: number;
  durationMs?: number;
}

export interface ChatMessage {
  uiBlocks?: AiDataBlock[];
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: boolean;
  tools?: string[];
  actionItems?: AiActionItem[];
  trace?: AgentTraceStep[];
  presentationMode?: AiPresentationMode;
  responseTitle?: string;
  notices?: AiNotice[];
  responseMeta?: AiResponseMeta;
  suggestedActions?: AiSuggestedAction[];
  durationMs?: number;
  thoughtSteps?: string[];
  thinkingTime?: string;
  isCommand?: boolean;
  commandLabel?: string;
  modelMode?: AiModelMode;
  createdAt: string | Date;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  backendSessionId?: number | null;
  messages: ChatMessage[];
}

export interface AiSocketEvent {
  ui_blocks?: unknown;
  type:
    | 'connected'
    | 'task_started'
    | 'task_cancelled'
    | 'task_completed'
    | 'task_failed'
    | 'thought'
    | 'progress'
    | 'answer_snapshot'
    | 'model_status'
    | 'tool_start'
    | 'tool_result'
    | 'results'
    | 'presentation'
    | 'token'
    | 'done'
    | 'error'
    | 'pong';
  status?: 'loading' | 'ready';
  concurrent?: boolean;
  request_id?: string;
  task_id?: string;
  request_version?: number;
  content?: string;
  text?: string;
  message?: string;
  code?: string;
  name?: string;
  label?: string;
  result?: unknown;
  session_id?: number;
  interaction_id?: number;
  tools?: string[];
  action_items?: AiActionItem[];
  mode?: AiPresentationMode | string;
  model_role?: string;
  title?: string;
  card_count?: number;
  presentation_mode?: AiPresentationMode;
  response_title?: string;
  duration_ms?: number;
  notices?: AiNotice[];
  response_meta?: AiResponseMeta;
  suggested_actions?: AiSuggestedAction[];
}
