export interface ReplayAction {
  user_id: string;
  action: string;
  amount: number | null;
  timestamp: string;
}

export interface ReplayPlayer {
  user_id: string;
  username: string;
  seat: number;
  stack: number;
  hole_cards: string[];
  mucked: boolean;
  in_hand: boolean;
}

export interface ReplayFrame {
  frame_index: number;
  timestamp: string;
  street: number | null;
  community_cards: string[];
  pot: number;
  active_seat: number | null;
  last_action: ReplayAction | null;
  players: ReplayPlayer[];
}

export interface ReplayWinner {
  user_id: string;
  amount: number;
}

export interface ReplayPayload {
  hand_id: string;
  timestamp: string | null;
  final_board: string[];
  pot_total: number;
  is_showdown: boolean;
  winners: ReplayWinner[];
  total_frames: number;
  frames: ReplayFrame[];
}