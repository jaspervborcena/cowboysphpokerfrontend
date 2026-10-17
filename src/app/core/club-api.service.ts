import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClubMembershipResponse {
  club_id: string;
  user_id: string;
  username: string;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'PLAYER';
}

export interface ClubMemberWalletSummary {
  club_id: string;
  user_id: string;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'PLAYER';
  currency_type: 'CLUB_CHIPS';
  available_balance: number;
  in_play_balance: number;
}

export interface ClubTableSummary {
  table_id: string;
  table_name: string;
  game_id?: string;
  game?: string;
  is_union_table: boolean;
  union_id: string | null;
  origin_club_id: string | null;
  small_blind: number;
  big_blind: number;
  buy_in_min: number;
  buy_in_max: number;
  table_size?: number;
  max_seats?: number;
  seated_count: number;
  is_hand_running: boolean;
}

export interface ClubTableCreateRequest {
  game_id: string;
  small_blind: number;
  big_blind: number;
  buy_in_min: number;
  buy_in_max: number;
  table_size: number;
}

export interface GameCatalogEntry {
  game_id: string;
  display_name: string;
  create_supported: boolean;
}

export interface GameCatalogResponse {
  active_game_id: string;
  games: GameCatalogEntry[];
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

export interface GlobalWalletResponse {
  wallet_id: string;
  wallet_type: 'GLOBAL_PLAYMONEY';
  currency_type: 'GLOBAL_PLAYMONEY';
  user_id: string;
  balance: number;
}

export interface GlobalWalletEnsureResponse extends GlobalWalletResponse {
  created: boolean;
}

export interface ClubTreasuryResponse {
  club_id: string;
  currency_type: 'CLUB_CHIPS';
  chip_balance: number;
}

export interface ClubWalletTransferRequest {
  user_id: string;
  amount: number;
  transaction_id: string;
  note?: string;
}

export interface MemberTransferResponse {
  club_id: string;
  transaction_id: string;
  type: 'SEND_OUT' | 'CLAIM_BACK';
  amount: number;
  from_user_id: string;
  to_user_id: string;
  status: 'completed' | 'idempotent_replay';
}

export interface ClubTreasuryTransferRequest {
  destination_club_id: string;
  amount: number;
  transaction_id: string;
  note?: string;
}

export interface InterClubTransferResponse {
  transaction_id: string;
  type: 'INTER_CLUB_TRANSFER';
  from_club_id: string;
  to_club_id: string;
  amount: number;
  status: 'completed' | 'idempotent_replay';
}

@Injectable({ providedIn: 'root' })
export class ClubApiService {
  private readonly http = inject(HttpClient);

  getGames(apiBase: string): Observable<GameCatalogResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/games`;
    return this.http.get<GameCatalogResponse>(url);
  }

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

  requestPhonePasswordReset(apiBase: string, phoneNumber: string): Observable<unknown> {
    const url = `${apiBase.replace(/\/$/, '')}/auth/phone/password-reset/request`;
    return this.http.post<unknown>(url, { phone_number: phoneNumber });
  }

  confirmPhonePasswordReset(
    apiBase: string,
    request: { phone_number: string; otp: string; new_password: string }
  ): Observable<unknown> {
    const url = `${apiBase.replace(/\/$/, '')}/auth/phone/password-reset/confirm`;
    return this.http.post<unknown>(url, request);
  }

  getMembership(apiBase: string, clubId: string, idToken: string): Observable<ClubMembershipResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/members/me`;
    return this.http.get<ClubMembershipResponse>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getMemberWalletSummary(apiBase: string, clubId: string, idToken: string): Observable<ClubMemberWalletSummary> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/members/me/wallet`;
    return this.http.get<ClubMemberWalletSummary>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  ensureGlobalWallet(apiBase: string, idToken: string): Observable<GlobalWalletEnsureResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/me/wallets/global-playmoney/ensure`;
    return this.http.post<GlobalWalletEnsureResponse>(url, null, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getGlobalWallet(apiBase: string, idToken: string): Observable<GlobalWalletResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/me/wallets/global-playmoney`;
    return this.http.get<GlobalWalletResponse>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  getClubTreasury(apiBase: string, clubId: string, idToken: string): Observable<ClubTreasuryResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/wallet`;
    return this.http.get<ClubTreasuryResponse>(url, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  transferClubTreasury(
    apiBase: string,
    clubId: string,
    idToken: string,
    request: ClubTreasuryTransferRequest
  ): Observable<InterClubTransferResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/wallet/transfers`;
    return this.http.post<InterClubTransferResponse>(url, request, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  sendOutClubChips(
    apiBase: string,
    clubId: string,
    idToken: string,
    request: ClubWalletTransferRequest
  ): Observable<MemberTransferResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/wallet/send-out`;
    return this.http.post<MemberTransferResponse>(url, request, {
      headers: new HttpHeaders({ Authorization: `Bearer ${idToken}` })
    });
  }

  claimBackClubChips(
    apiBase: string,
    clubId: string,
    idToken: string,
    request: ClubWalletTransferRequest
  ): Observable<MemberTransferResponse> {
    const url = `${apiBase.replace(/\/$/, '')}/clubs/${encodeURIComponent(clubId)}/wallet/claim-back`;
    return this.http.post<MemberTransferResponse>(url, request, {
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
      game_id: string;
      table_name: string;
      small_blind: number;
      big_blind: number;
      buy_in_min: number;
      buy_in_max: number;
      table_size: number;
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
