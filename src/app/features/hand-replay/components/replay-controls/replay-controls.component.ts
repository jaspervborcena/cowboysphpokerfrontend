import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-replay-controls',
  templateUrl: './replay-controls.component.html',
  styleUrl: './replay-controls.component.css'
})
export class ReplayControlsComponent {
  readonly currentFrameIndex = input.required<number>();
  readonly totalFrames = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly speed = input.required<number>();
  readonly playPause = output<void>();
  readonly next = output<void>();
  readonly prev = output<void>();
  readonly seek = output<number>();
  readonly speedChange = output<number>();
}