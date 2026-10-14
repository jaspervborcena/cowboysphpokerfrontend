import { computed, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { HandReplayApiService } from '../services/hand-replay-api.service';
import { ReplayPayload } from '../models/hand-replay.models';

@Injectable({ providedIn: 'root' })
export class HandReplayStore {
  readonly replayData = signal<ReplayPayload | null>(null);
  readonly currentFrameIndex = signal(0);
  readonly currentFrame = computed(() => {
    const replay = this.replayData();
    return replay?.frames[this.currentFrameIndex()] ?? null;
  });
  readonly isPlaying = signal(false);
  readonly playbackSpeed = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private playbackTimer: ReturnType<typeof setInterval> | null = null;
  private request: Subscription | null = null;

  constructor(private readonly api: HandReplayApiService) {}

  load(apiBase: string, clubId: string, handId: string, unionId: string | null = null): void {
    this.pause();
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.replayData.set(null);
    this.currentFrameIndex.set(0);
    this.request = this.api.getReplay(apiBase, clubId, handId, unionId).subscribe({
      next: (replay) => {
        this.replayData.set(replay);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error instanceof Error ? error.message : 'Could not load this hand replay.');
      }
    });
  }

  play(): void {
    const frames = this.replayData()?.frames ?? [];
    if (frames.length < 2) return;
    if (this.currentFrameIndex() >= frames.length - 1) this.currentFrameIndex.set(0);
    this.isPlaying.set(true);
    this.startPlaybackTimer();
  }

  pause(): void {
    this.isPlaying.set(false);
    if (this.playbackTimer !== null) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  togglePlayback(): void {
    if (this.isPlaying()) this.pause();
    else this.play();
  }

  nextFrame(): void {
    this.seekTo(this.currentFrameIndex() + 1);
  }

  prevFrame(): void {
    this.seekTo(this.currentFrameIndex() - 1);
  }

  seekTo(index: number): void {
    const lastFrame = Math.max(0, (this.replayData()?.frames.length ?? 1) - 1);
    const safeIndex = Math.max(0, Math.min(Math.trunc(index), lastFrame));
    this.currentFrameIndex.set(safeIndex);
    if (safeIndex === lastFrame) this.pause();
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed.set(Math.max(0.5, Math.min(2, speed)));
    if (this.isPlaying()) this.startPlaybackTimer();
  }

  private startPlaybackTimer(): void {
    if (this.playbackTimer !== null) clearInterval(this.playbackTimer);
    this.playbackTimer = setInterval(
      () => this.nextFrame(),
      1000 / this.playbackSpeed()
    );
  }
}