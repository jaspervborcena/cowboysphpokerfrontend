import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { HandReplayApiService } from '../services/hand-replay-api.service';
import { ReplayPayload } from '../models/hand-replay.models';
import { HandReplayStore } from './hand-replay.store';

const sampleReplay: ReplayPayload = {
  hand_id: 'hand-1',
  timestamp: '2026-10-14T10:00:00Z',
  final_board: ['As', '3h', '5d'],
  pot_total: 450,
  is_showdown: false,
  winners: [{ user_id: 'player-a', amount: 450 }],
  total_frames: 3,
  frames: [
    {
      frame_index: 0,
      timestamp: '2026-10-14T10:00:00Z',
      street: 0,
      community_cards: [],
      pot: 30,
      active_seat: 0,
      last_action: null,
      players: []
    },
    {
      frame_index: 1,
      timestamp: '2026-10-14T10:00:01Z',
      street: 1,
      community_cards: ['As', '3h', '5d'],
      pot: 150,
      active_seat: 1,
      last_action: null,
      players: []
    },
    {
      frame_index: 2,
      timestamp: '2026-10-14T10:00:02Z',
      street: 1,
      community_cards: ['As', '3h', '5d'],
      pot: 450,
      active_seat: null,
      last_action: null,
      players: []
    }
  ]
};

describe('HandReplayStore', () => {
  let store: HandReplayStore;
  let api: jasmine.SpyObj<HandReplayApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<HandReplayApiService>('HandReplayApiService', ['getReplay']);
    api.getReplay.and.returnValue(of(sampleReplay));
    TestBed.configureTestingModule({ providers: [{ provide: HandReplayApiService, useValue: api }] });
    store = TestBed.inject(HandReplayStore);
  });

  it('loads replay data and steps through frames', () => {
    store.load('http://localhost:8000', 'demo', 'hand-1');

    expect(store.replayData()).toBe(sampleReplay);
    expect(store.currentFrame()?.community_cards).toEqual([]);
    store.nextFrame();
    expect(store.currentFrameIndex()).toBe(1);
    expect(store.currentFrame()?.community_cards).toEqual(['As', '3h', '5d']);
    store.prevFrame();
    expect(store.currentFrameIndex()).toBe(0);
  });

  it('clamps seeks and playback speed to supported bounds', () => {
    store.load('http://localhost:8000', 'demo', 'hand-1');
    store.seekTo(99);
    expect(store.currentFrameIndex()).toBe(2);
    store.seekTo(-4);
    expect(store.currentFrameIndex()).toBe(0);
    store.setPlaybackSpeed(4);
    expect(store.playbackSpeed()).toBe(2);
  });

  it('advances frames during playback and stops at the end', fakeAsync(() => {
    store.load('http://localhost:8000', 'demo', 'hand-1');
    store.play();

    tick(1000);
    expect(store.currentFrameIndex()).toBe(1);
    tick(1000);
    expect(store.currentFrameIndex()).toBe(2);
    expect(store.isPlaying()).toBeFalse();
  }));
});