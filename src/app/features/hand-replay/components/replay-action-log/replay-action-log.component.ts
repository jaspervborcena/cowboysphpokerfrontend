import { Component, input, output } from '@angular/core';
import { ReplayFrame } from '../../models/hand-replay.models';

@Component({
  selector: 'app-replay-action-log',
  templateUrl: './replay-action-log.component.html',
  styleUrl: './replay-action-log.component.css'
})
export class ReplayActionLogComponent {
  readonly frames = input.required<ReplayFrame[]>();
  readonly currentFrameIndex = input.required<number>();
  readonly seek = output<number>();

  get actionFrames(): ReplayFrame[] {
    return this.frames().filter((frame) => frame.last_action !== null);
  }

  playerName(frame: ReplayFrame, userId: string): string {
    return frame.players.find((player) => player.user_id === userId)?.username ?? userId;
  }
}