import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AiRuntimeStatus, SalesInventoryMetrics } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class OperationsApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  metrics(): Observable<SalesInventoryMetrics> { return this.http.get<SalesInventoryMetrics>(`${this.runtime.apiUrl}/admin/metrics/sales-inventory`); }
  aiMetrics(): Observable<Array<Record<string, unknown>>> { return this.http.get<Array<Record<string, unknown>>>(`${this.runtime.apiUrl}/admin/metrics/ai`); }
  aiRuntime(): Observable<AiRuntimeStatus> { return this.http.get<AiRuntimeStatus>(`${this.runtime.apiUrl}/admin/ai/runtime`); }
  startAi(): Observable<AiRuntimeStatus> { return this.http.post<AiRuntimeStatus>(`${this.runtime.apiUrl}/admin/ai/runtime/start`, {}); }
  stopAi(): Observable<AiRuntimeStatus> { return this.http.post<AiRuntimeStatus>(`${this.runtime.apiUrl}/admin/ai/runtime/stop`, {}); }
}
