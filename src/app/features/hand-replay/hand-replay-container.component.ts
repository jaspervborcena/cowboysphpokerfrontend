import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReplayActionLogComponent } from './components/replay-action-log/replay-action-log.component';
import { ReplayControlsComponent } from './components/replay-controls/replay-controls.component';
import { ReplayTableCanvasComponent } from './components/replay-table-canvas/replay-table-canvas.component';
import { HandReplayStore } from './state/hand-replay.store';

@Component({
  selector: 'app-hand-replay-container',
  imports: [DecimalPipe, ReplayActionLogComponent, ReplayControlsComponent, ReplayTableCanvasComponent],
  templateUrl: './hand-replay-container.component.html',
  styleUrl: './hand-replay-container.component.css'
})
export class HandReplayContainerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) apiBase = '';
  @Input({ required: true }) clubId = '';
  @Input({ required: true }) handId = '';
  @Output() readonly close = new EventEmitter<void>();

  constructor(readonly store: HandReplayStore) {}

  ngOnInit(): void {
    this.store.load(this.apiBase, this.clubId, this.handId);
  }

  ngOnDestroy(): void {
    this.store.pause();
  }

  retry(): void {
    this.store.load(this.apiBase, this.clubId, this.handId);
  }
}