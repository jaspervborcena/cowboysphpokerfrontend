import { TableRules } from './table-rules.types';

export const noLimitHoldemRingRules = {
  gameIds: ['no_limit_texas_holdem'],
  displayName: 'No-Limit Hold’em Ring',
  format: 'RING',
  buyIn: {
    confirmBeforeSeating: true,
    currency: 'CLUB_CHIPS',
    minimumSource: 'TABLE',
    maximumSource: 'TABLE'
  },
  blindEntry: {
    decisions: ['POST_BLIND', 'WAIT_FOR_BIG_BLIND'],
    event: 'BLIND_DECISION'
  },
  turnPolicy: {
    actionSeconds: 20,
    disconnectGraceSeconds: 20,
    disconnectTimeoutsBeforeSitOut: 2,
    normalActionTimeout: 'CHECK_IF_LEGAL_ELSE_FOLD',
    disconnectTimeout: 'FOLD'
  }
} as const satisfies TableRules;