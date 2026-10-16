export type TableFormat = 'RING';
export type BlindEntryChoice = 'POST_BLIND' | 'WAIT_FOR_BIG_BLIND';

export interface TableRules {
  gameIds: readonly string[];
  displayName: string;
  format: TableFormat;
  buyIn: {
    confirmBeforeSeating: boolean;
    currency: 'CLUB_CHIPS';
    minimumSource: 'TABLE';
    maximumSource: 'TABLE';
  };
  blindEntry: {
    decisions: readonly BlindEntryChoice[];
    event: 'BLIND_DECISION';
  };
  turnPolicy: {
    actionSeconds: number;
    disconnectGraceSeconds: number;
    disconnectTimeoutsBeforeSitOut: number;
    normalActionTimeout: 'CHECK_IF_LEGAL_ELSE_FOLD';
    disconnectTimeout: 'FOLD';
  };
}