import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClubMembershipResponse {
  club_id: string;
  user_id: string;
  username: string;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'PLAYER';
}

export interface ClubTableSummary {
  table_id: string;
  table_name: string;
  is_union_table: boolean;
  union_id: string | null;
  origin_club_id: string | null;
  small_blind: number;
  big_blind: number;
  buy_in_min: number;
  buy_in_max: number;
  max_seats: number;
  seated_count: number;
  is_hand_running: boolean;
}

export interface ClubUnionSummary {
  union_id: string;
  name: string;
}

export interface UnionMembershipResponse {
  union_id: string;
  user_id: string;
  role: 'UNION_ADMIN';
}

export interface CreateUnionTableResponse {
  union_id: string;
  table_id: string;
  origin_club_id: string;
  status: string;
}

export interface PhonePasswordSignInResponse {
  firebase_custom_token: string;
}

@Injectable({ providedIn: 'root' })
export class ClubApiService {
  private readonly http = inject(HttpClient);

  signInWithPhonePassword(
    apiBase: string,
    phoneNumber: string,
    password: string
  ): Observable<PhonePasswordSignInResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/auth/phone/sign-in`;
    return this.http.post<PhonePasswordSignInResponse>(url, {
      phone_number: phoneNumber,
      password
    });
  }

  getMembership(apiBase: string, clubId: string, idToken: string): Observable<ClubMembershipResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/members/me`;
    return this.http.get<ClubMembershipResponse>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getTables(apiBase: string, clubId: string, idToken: string): Observable<ClubTableSummary[]> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/tables`;
    return this.http.get<ClubTableSummary[]>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getUnions(apiBase: string, clubId: string, idToken: string): Observable<ClubUnionSummary[]> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/unions`;
    return this.http.get<ClubUnionSummary[]>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getUnionMembership(apiBase: string, unionId: string, idToken: string): Observable<UnionMembershipResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/unions/${encodeURIComponent(unionId)}/membership/me`;
    return this.http.get<UnionMembershipResponse>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getUnionTables(
    apiBase: string,
    clubId: string,
    unionId: string,
    idToken: string
  ): Observable<ClubTableSummary[]> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/unions/${encodeURIComponent(unionId)}/tables`;
    return this.http.get<ClubTableSummary[]>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  createUnionTable(
    apiBase: string,
    unionId: string,
    tableId: string,
    idToken: string,
    request: {
      origin_club_id: string;
      table_name: string;
      small_blind: number;
      big_blind: number;
      buy_in_min: number;
      buy_in_max: number;
      table_size?: number;
    }
  ): Observable<CreateUnionTableResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/unions/${encodeURIComponent(unionId)}/tables/${encodeURIComponent(tableId)}`;
    return this.http.post<CreateUnionTableResponse>(url, request, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  seatUnionPlayer(
    apiBase: string,
    unionId: string,
    tableId: string,
    clubId: string,
    idToken: string,
    request: { seat_index: number; buy_in_amount: number; buy_in_id: string }
  ): Observable<unknown> {
    const url = `${apiBase.replace(/\/$/, '')}/unions/${encodeURIComponent(unionId)}/tables/${encodeURIComponent(tableId)}/clubs/${encodeURIComponent(clubId)}/seats`;
    return this.http.post<unknown>(url, request, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  startUnionHand(apiBase: string, unionId: string, tableId: string, idToken: string): Observable<unknown> {
    const url = `${apiBase.replace(/\/$/, '')}/unions/${encodeURIComponent(unionId)}/tables/${encodeURIComponent(tableId)}/hands`;
    return this.http.post<unknown>(url, null, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  deleteUnionTable(apiBase: string, unionId: string, tableId: string, idToken: string): Observable<void> {
    const url = `${apiBase.replace(/\/$/, '')}/unions/${encodeURIComponent(unionId)}/tables/${encodeURIComponent(tableId)}`;
    return this.http.delete<void>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }
}
