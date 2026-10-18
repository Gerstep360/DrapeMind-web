import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { AiSocketService } from './ai-socket.service';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';
import { ToastService } from './toast.service';
import { AiSocketEvent } from './models';

describe('Concurrent Altair events', () => {
  let service: AiSocketService;
  const receive = (event: AiSocketEvent) =>
    (service as unknown as { handleEvent(event: AiSocketEvent): void }).handleEvent(event);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AiSocketService,
        { provide: AuthService, useValue: { user: signal(null), hasValidToken: () => false } },
        { provide: RuntimeConfigService, useValue: { apiUrl: '/api/v1' } },
        { provide: HttpClient, useValue: {} },
        { provide: ToastService, useValue: { show: () => undefined } },
      ],
    });
    service = TestBed.inject(AiSocketService);
    service.activeSessionId.set('chat');
    service.sessions.set([
      {
        id: 'chat',
        title: 'Style',
        createdAt: '',
        updatedAt: '',
        messages: [
          { id: 'm1', role: 'assistant', content: '', pending: true, createdAt: new Date() },
          { id: 'm2', role: 'assistant', content: '', pending: true, createdAt: new Date() },
        ],
      },
    ]);
  });

  it('routes out-of-order answers and completion to their own messages', () => {
    receive({ type: 'answer_snapshot', request_id: 'm2', content: 'Shipping policy' });
    receive({ type: 'done', request_id: 'm2', duration_ms: 20 });
    expect(service.messages()[0].pending).toBe(true);
    expect(service.messages()[1].content).toBe('Shipping policy');
    receive({ type: 'answer_snapshot', request_id: 'm1', content: 'Products' });
    receive({ type: 'done', request_id: 'm1', duration_ms: 40 });
    expect(service.messages().map((message) => message.content)).toEqual([
      'Products',
      'Shipping policy',
    ]);
    expect(service.isBusy()).toBe(false);
  });

  it('clears cancelled results and ignores unknown request IDs', () => {
    receive({
      type: 'results',
      request_id: 'm1',
      action_items: [{ id: 3, nombre: 'Shirt', precio: 100, accion: 'AGREGAR' }],
    });
    receive({ type: 'task_cancelled', request_id: 'm1' });
    expect(service.messages()[0].pending).toBe(false);
    expect(service.messages()[0].actionItems).toEqual([]);
    receive({ type: 'answer_snapshot', request_id: 'unknown', content: 'Wrong conversation' });
    expect(service.messages()[1].content).toBe('');
  });

  it('permits a follow-up only when the server advertises concurrency', () => {
    expect(service.canSend()).toBe(false);
    receive({ type: 'connected', concurrent: true });
    expect(service.canSend()).toBe(true);
    service.sessions.update((sessions) =>
      sessions.map((session) => ({
        ...session,
        messages: [
          ...session.messages,
          { id: 'm3', role: 'assistant', content: '', pending: true, createdAt: new Date() },
        ],
      })),
    );
    expect(service.canSend()).toBe(false);
  });

  it('keeps dynamic UI attached to its request and removes it on cancellation', () => {
    const block = {
      type: 'information',
      title: 'Envíos',
      source_tool: 'get_store_policy',
      body: 'Retiro en tienda.',
      tone: 'neutral',
    };
    receive({ type: 'presentation', request_id: 'm2', ui_blocks: [block] });
    expect(service.messages()[0].uiBlocks).toBeUndefined();
    expect(service.messages()[1].uiBlocks?.[0].type).toBe('information');
    receive({ type: 'task_cancelled', request_id: 'm2' });
    expect(service.messages()[1].uiBlocks).toEqual([]);
  });
});
