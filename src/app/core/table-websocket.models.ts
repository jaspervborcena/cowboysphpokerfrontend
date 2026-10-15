export interface TableWebSocketEnvelope<TPayload = unknown> {
  version: '1.0';
  topic: string;
  event: string;
  correlation_id: string;
  payload: TPayload;
}

export interface TableActionPayload {
  action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE';
  amount?: number;
  action_id: string;
}

export interface TableSocketErrorPayload {
  status?: number;
  code?: number;
  message?: string;
  errors?: unknown;
  trace_id?: string;
}
