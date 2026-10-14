import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserSessionStore } from '../../../core/user-session.store';
import { HandReplayApiService } from './hand-replay-api.service';

describe('HandReplayApiService', () => {
  let service: HandReplayApiService;
  let http: HttpTestingController;
  let session: UserSessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(HandReplayApiService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(UserSessionStore);
  });

  afterEach(() => http.verify());

  it('sends the Firebase ID token with the replay request', () => {
    session.setVerifiedMember('player-a', 'Alice', 'PLAYER', 'firebase-token');
    service.getReplay('http://localhost:8000/', 'club demo', 'hand/1').subscribe();

    const request = http.expectOne(
      'http://localhost:8000/clubs/club%20demo/hands/hand%2F1/replay'
    );
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    request.flush({
      hand_id: 'hand/1',
      timestamp: null,
      final_board: [],
      pot_total: 0,
      is_showdown: false,
      winners: [],
      total_frames: 0,
      frames: []
    });
  });

  it('does not make an unauthenticated replay request', () => {
    let errorMessage = '';
    service.getReplay('http://localhost:8000', 'demo', 'hand-1').subscribe({
      error: (error: Error) => errorMessage = error.message
    });

    expect(errorMessage).toContain('Sign in with Firebase');
    http.expectNone('http://localhost:8000/clubs/demo/hands/hand-1/replay');
  });
});