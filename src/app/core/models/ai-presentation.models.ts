export interface AiShoppingQuestion {
  type: 'shopping_question';
  title: string;
  source_tool: string;
  goal: string;
  request: string;
  fields: {
    key: string;
    label: string;
    kind: 'text' | 'number' | 'select';
    value: string;
    required: boolean;
    options: { value: string; label: string }[];
  }[];
  applied: string[];
  note?: string;
}
export type AiDataBlock =
  | AiShoppingQuestion
  | {
      type: 'shopping_summary';
      title: string;
      source_tool: string;
      criteria: string[];
      metrics: { label: string; value: string }[];
      items: { label: string; detail: string; badge: string }[];
      note?: string;
    }
  | {
      type: 'branch_options';
      title: string;
      source_tool: string;
      city: string;
      items: {
        id: number;
        name: string;
        address: string;
        city: string;
        coverage: string;
        complete: boolean;
        same_city: boolean;
      }[];
      note?: string;
    }
  | {
      type: 'data_table';
      title: string;
      source_tool: string;
      columns: { key: string; label: string }[];
      rows: Record<string, string>[];
      empty_message: string;
      note?: string;
    }
  | {
      type: 'metrics';
      title: string;
      source_tool: string;
      metrics: { label: string; value: string }[];
      lines: { label: string; value: string }[];
      note?: string;
    }
  | {
      type: 'status_list';
      title: string;
      source_tool: string;
      items: { label: string; status: string; detail: string }[];
      route: '/orders' | '/reservations';
      empty_message: string;
      note?: string;
    }
  | {
      type: 'information';
      title: string;
      source_tool: string;
      body: string;
      tone: 'neutral' | 'notice';
      note?: string;
    };

/** Unknown/legacy blocks never become HTML, styles, routes or executable templates. */
export function readAiDataBlocks(value: unknown): AiDataBlock[] {
  if (!Array.isArray(value)) return [];
  const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 1200;
  const pairs = (v: unknown) =>
    Array.isArray(v) && v.length <= 20 && v.every((p) => p && text(p.label) && text(p.value));
  return value.slice(0, 4).filter((block): block is AiDataBlock => {
    if (
      !block ||
      !text(block.title) ||
      !text(block.source_tool) ||
      (block.note !== undefined && !text(block.note))
    )
      return false;
    switch (block.type) {
      case 'shopping_question':
        return (
          ['discover', 'new_arrivals', 'outfit', 'branches', 'budget', 'savings'].includes(
            block.goal,
          ) &&
          text(block.request) &&
          Array.isArray(block.applied) &&
          block.applied.length <= 8 &&
          block.applied.every(text) &&
          Array.isArray(block.fields) &&
          block.fields.length <= 6 &&
          new Set(block.fields.map((f: { key: string }) => f?.key)).size === block.fields.length &&
          block.fields.every(
            (f: AiShoppingQuestion['fields'][number]) =>
              f &&
              [
                'query',
                'category_id',
                'budget',
                'city',
                'occasion',
                'top_size',
                'bottom_size',
                'shoe_size',
                'color',
                'max_items',
                'keep_color',
              ].includes(f.key) &&
              text(f.label) &&
              text(f.value) &&
              ['text', 'number', 'select'].includes(f.kind) &&
              typeof f.required === 'boolean' &&
              Array.isArray(f.options) &&
              f.options.length <= 100 &&
              f.options.every((o) => o && text(o.value) && text(o.label)),
          )
        );
      case 'shopping_summary':
        return (
          Array.isArray(block.criteria) &&
          block.criteria.length <= 12 &&
          block.criteria.every(text) &&
          pairs(block.metrics) &&
          Array.isArray(block.items) &&
          block.items.length <= 12 &&
          block.items.every(
            (i: { label: unknown; detail: unknown; badge: unknown }) =>
              i && text(i.label) && text(i.detail) && text(i.badge),
          )
        );
      case 'branch_options':
        return (
          text(block.city) &&
          Array.isArray(block.items) &&
          block.items.length <= 6 &&
          block.items.every(
            (i: {
              id: number;
              name: unknown;
              address: unknown;
              city: unknown;
              coverage: unknown;
              complete: unknown;
              same_city: unknown;
            }) =>
              i &&
              Number.isSafeInteger(i.id) &&
              i.id > 0 &&
              text(i.name) &&
              text(i.address) &&
              text(i.city) &&
              text(i.coverage) &&
              typeof i.complete === 'boolean' &&
              typeof i.same_city === 'boolean',
          )
        );
      case 'data_table':
        return (
          Array.isArray(block.columns) &&
          block.columns.length > 0 &&
          block.columns.length <= 6 &&
          block.columns.every(
            (c: { key: unknown; label: unknown }) => c && text(c.key) && text(c.label),
          ) &&
          Array.isArray(block.rows) &&
          block.rows.length <= 20 &&
          block.rows.every(
            (r: Record<string, unknown>) =>
              r &&
              typeof r === 'object' &&
              !Array.isArray(r) &&
              block.columns.every((c: { key: string }) => text(r[c.key])),
          ) &&
          text(block.empty_message)
        );
      case 'metrics':
        return pairs(block.metrics) && pairs(block.lines);
      case 'status_list':
        return (
          ['/orders', '/reservations'].includes(block.route) &&
          Array.isArray(block.items) &&
          block.items.length <= 20 &&
          block.items.every(
            (i: { label: unknown; status: unknown; detail: unknown }) =>
              i && text(i.label) && text(i.status) && text(i.detail),
          ) &&
          text(block.empty_message)
        );
      case 'information':
        return text(block.body) && ['neutral', 'notice'].includes(block.tone);
      default:
        return false;
    }
  });
}
