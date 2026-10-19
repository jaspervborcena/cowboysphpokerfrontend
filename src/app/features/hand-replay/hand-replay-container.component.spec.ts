import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReplayPayload } from './models/hand-replay.models';
import { HandReplayContainerComponent } from './hand-replay-container.component';
import { HandReplayStore } from './state/hand-replay.store';

const replay: ReplayPayload = {
  hand_id: 'hand-42',
  timestamp: '2026-10-19T08:06:44Z',
  final_board: ['As', 'Kh', '2d'],
  pot_total: 40,
  is_showdown: true,
  winners: [{ user_id: 'player-a', amount: 40 }],
  total_frames: 2,
  frames: [
    {
      frame_index: 0,
      timestamp: '2026-10-19T08:06:45Z',
      street: 0,
      community_cards: [],
      pot: 20,
      active_seat: 0,
      last_action: { user_id: 'player-a', action: 'CALL', amount: 10, timestamp: '2026-10-19T08:06:45Z' },
      players: [
        { user_id: 'player-a', username: 'Alice', seat: 0, stack: 90, hole_cards: ['As', 'Kd'], mucked: false, in_hand: true },
        { user_id: 'player-b', username: 'Bob', seat: 1, stack: 90, hole_cards: ['??', '??'], mucked: true, in_hand: false }
      ]
    },
    {
      frame_index: 1,
      timestamp: '2026-10-19T08:06:48Z',
      street: 1,
      community_cards: ['As', 'Kh', '2d'],
      pot: 40,
      active_seat: null,
      last_action: { user_id: 'player-b', action: 'FOLD', amount: null, timestamp: '2026-10-19T08:06:48Z' },
      players: [
        { user_id: 'player-a', username: 'Alice', seat: 0, stack: 120, hole_cards: ['As', 'Kd'], mucked: false, in_hand: true },
        { user_id: 'player-b', username: 'Bob', seat: 1, stack: 80, hole_cards: ['??', '??'], mucked: true, in_hand: false }
      ]
    }
  ]
};

const currentFrameIndex = signal(0);
const storeStub = {
  replayData: signal<ReplayPayload | null>(replay),
  currentFrameIndex,
  currentFrame: computed(() => replay.frames[currentFrameIndex()]),
  isPlaying: signal(false),
  playbackSpeed: signal(1),
  loading: signal(false),
  error: signal<string | null>(null),
  load: jasmine.createSpy('load'),
  pause: jasmine.createSpy('pause'),
  togglePlayback: jasmine.createSpy('togglePlayback'),
  prevFrame: jasmine.createSpy('prevFrame'),
  nextFrame: jasmine.createSpy('nextFrame'),
  seekTo: jasmine.createSpy('seekTo'),
  setPlaybackSpeed: jasmine.createSpy('setPlaybackSpeed')
};

describe('HandReplayContainerComponent', () => {
  let fixture: ComponentFixture<HandReplayContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HandReplayContainerComponent],
      providers: [{ provide: HandReplayStore, useValue: storeStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(HandReplayContainerComponent);
    fixture.componentRef.setInput('apiBase', 'https://api.example.test');
    fixture.componentRef.setInput('clubId', 'club-1');
    fixture.componentRef.setInput('handId', replay.hand_id);
    fixture.detectChanges();
  });

  it('shows the hand outcome in Summary by default', () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.summary-view')).not.toBeNull();
    expect(page.querySelector('app-replay-action-log')).toBeNull();
    expect(page.textContent).toContain('FINAL POT');
    expect(page.textContent).toContain('Won 40');
    expect(page.textContent).toContain('Folded');
    expect(page.querySelectorAll('.summary-board .summary-card').length).toBe(3);
  });

  it('shows street-grouped actions in Hand Detail', () => {
    const page = fixture.nativeElement as HTMLElement;
    const detailTab = page.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement;
    detailTab.click();
    fixture.detectChanges();

    expect(page.querySelector('.summary-view')).toBeNull();
    expect(page.querySelector('app-replay-action-log')).not.toBeNull();
    expect(page.querySelectorAll('.street-group').length).toBe(2);
    expect(page.querySelectorAll('.replay-action-row').length).toBe(2);
    expect(page.textContent).toContain('CALL');
    expect(page.textContent).toContain('FOLD');
    expect(page.textContent).toContain('Alice');
    expect(page.textContent).toContain('Pot 40');
  });
});
