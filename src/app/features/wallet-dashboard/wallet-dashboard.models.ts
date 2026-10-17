export type WalletType =
  | 'GLOBAL_PLAYMONEY'
  | 'CLUB_TREASURY'
  | 'CLUB_AGENT'
  | 'CLUB_PLAYER'
  | 'TABLE_ESCROW';

export type WalletCurrencyType = 'GLOBAL_PLAYMONEY' | 'CLUB_CHIPS';

export interface WalletViewer {
  user_id: string;
  username: string;
  club_id: string;
  roles: Array<'OWNER' | 'MANAGER' | 'AGENT' | 'PLAYER'>;
}

export interface WalletAccount {
  wallet_id: string;
  wallet_type: WalletType;
  currency_type: WalletCurrencyType;
  club_id?: string | null;
  owner_user_id?: string | null;
  balance?: number;
  available_balance?: number;
  in_play_balance?: number;
  updated_at: string;
}

export interface WalletTableStack {
  table_id: string;
  table_name: string;
  seat_index: number;
  stack: number;
  currency_type: WalletCurrencyType;
  status: string;
}

export interface WalletTransaction {
  transaction_id: string;
  wallet_type: WalletType;
  club_id: string | null;
  type: string;
  amount: number;
  direction: 'credit' | 'debit';
  counterparty_user_id?: string;
  table_id?: string;
  status: string;
  created_at: string;
}

export interface WalletOnboardingPreview {
  account_creation_grant: {
    wallet_type: 'GLOBAL_PLAYMONEY';
    currency_type: 'GLOBAL_PLAYMONEY';
    amount: number;
    status: 'mock_only';
    trigger: string;
    api_available: false;
  };
  club_creation_grant: {
    wallet_type: 'CLUB_TREASURY';
    currency_type: 'CLUB_CHIPS';
    amount: number;
    status: 'live';
    endpoint: string;
    owner_personal_balance_after_creation: number;
  };
}

export interface WalletCashoutRequest {
  request_id: string;
  wallet_type: 'CLUB_PLAYER';
  club_id: string;
  user_id: string;
  amount: number;
  status: 'pending_mock';
  player_request_api_available: false;
  operator_fulfillment_endpoint: string;
  blocked_while_in_play_balance_nonzero: boolean;
}

export interface WalletDashboard {
  mock_only: true;
  viewer: WalletViewer;
  global_wallet: WalletAccount & { wallet_type: 'GLOBAL_PLAYMONEY' };
  onboarding_preview: WalletOnboardingPreview;
  club_wallets: WalletAccount[];
  table_stacks: WalletTableStack[];
  recent_transactions: WalletTransaction[];
  cashout_requests: WalletCashoutRequest[];
}
