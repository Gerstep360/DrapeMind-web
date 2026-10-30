import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ExchangesComponent } from './exchanges.component';
import { OfflineService } from '../offline/offline.service';
import { AuthService } from '../../../core/auth.service';
import { RuntimeConfigService } from '../../../core/runtime-config.service';

describe('Recovery of garment exchanges', () => {
  const owner = 'https://store.example/api/v1|1:4';
  const payload = { operacion_id: '11111111-1111-4111-8111-111111111111' };
  let requests: HttpTestingController;
  let component: ExchangesComponent;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(`drapemind.exchange.pending|${owner}`, JSON.stringify(payload));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RuntimeConfigService, useValue: { apiUrl: '/api/v1' } },
        { provide: AuthService, useValue: { user: signal(null) } },
        {
          provide: OfflineService,
          useValue: {
            owner: signal(owner),
            online: signal(true),
            bundle: signal(null),
            download: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ExchangesComponent);
    fixture.detectChanges();
    component = fixture.componentInstance;
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    requests.verify();
    localStorage.clear();
  });
  it('keeps the frozen request when authentication expires', async () => {
    const work = component.checkPending();
    requests
      .expectOne(`/api/v1/retail/exchanges/operations/${payload.operacion_id}`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await work;
    expect(component.pending).toEqual(payload);
    expect(localStorage.getItem(`drapemind.exchange.pending|${owner}`)).toBeTruthy();
    requests.expectNone('/api/v1/retail/exchanges');
  });
  it('recovers a committed receipt without posting another exchange', async () => {
    const work = component.checkPending();
    requests
      .expectOne(`/api/v1/retail/exchanges/operations/${payload.operacion_id}`)
      .flush({ id: 7, sale: { pedido_id: 12 } });
    await work;
    expect(component.result.id).toBe(7);
    expect(component.pending).toBeNull();
    expect(localStorage.getItem(`drapemind.exchange.pending|${owner}`)).toBeNull();
    requests.expectNone('/api/v1/retail/exchanges');
  });
});
