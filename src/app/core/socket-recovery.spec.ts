import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { vi, afterEach } from 'vitest';
import { AiSocketService } from './ai-socket.service';
import { EventsSocketService } from './events-socket.service';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';
import { ToastService } from './toast.service';

class OfflineSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static instances: OfflineSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  constructor() {
    OfflineSocket.instances.push(this);
  }
  close() {
    this.readyState = 3;
  }
  send() {}
  fail() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

describe('Socket recovery after a backend restart', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  for (const serviceType of [AiSocketService, EventsSocketService]) {
    it(`${serviceType.name} reconnects after more than five failures and stops on logout`, () => {
      vi.useFakeTimers();
      OfflineSocket.instances = [];
      vi.stubGlobal('WebSocket', OfflineSocket);
      TestBed.configureTestingModule({
        providers: [
          serviceType,
          {
            provide: AuthService,
            useValue: { user: signal(null), token: signal('qa-token'), hasValidToken: () => true },
          },
          {
            provide: RuntimeConfigService,
            useValue: {
              apiUrl: '/api/v1',
              wsUrl: (channel: string) => `ws://localhost/api/v1/ws/${channel}`,
            },
          },
          { provide: HttpClient, useValue: {} },
          { provide: ToastService, useValue: { show: () => undefined } },
        ],
      });
      const service = TestBed.inject(serviceType as typeof AiSocketService);
      service.connect();
      for (let failure = 0; failure < 8; failure++) {
        OfflineSocket.instances.at(-1)!.fail();
        vi.advanceTimersByTime(Math.min(30_000, 1000 * 2 ** failure));
      }
      expect(OfflineSocket.instances.length).toBe(9);
      OfflineSocket.instances.at(-1)!.fail();
      service.disconnect();
      vi.advanceTimersByTime(60_000);
      expect(OfflineSocket.instances.length).toBe(9);
    });
  }
});
