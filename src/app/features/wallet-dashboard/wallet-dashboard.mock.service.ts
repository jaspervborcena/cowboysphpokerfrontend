import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WalletDashboard } from './wallet-dashboard.models';

@Injectable({ providedIn: 'root' })
export class WalletDashboardMockService {
  private readonly http = inject(HttpClient);

  load(): Observable<WalletDashboard> {
    return this.http.get<WalletDashboard>('/ui-mocks/wallet-dashboard.json');
  }
}
