import { V2Room } from '../server/room.js';

export class LocalAuthoritativeTransport {
  constructor(options = {}) {
    this.room = options.room || new V2Room(options);
    this.clientId = options.clientId || 'player-1';
    this.playerName = options.playerName || 'Player';
    this.onmessage = null;
    this.connected = false;
    this.snapshotTimerMs = 0;
  }

  connect() {
    if (this.connected) return;
    this.connected = true;
    this.emit(this.room.connect(this.clientId, this.playerName));
  }

  send(message) {
    if (!this.connected) return;
    this.room.receive(this.clientId, message);
  }

  step(dtMs) {
    if (!this.connected) return;
    this.room.step(dtMs);
    this.snapshotTimerMs -= dtMs;
    if (this.snapshotTimerMs <= 0) {
      this.snapshotTimerMs += this.room.snapshotIntervalMs;
      this.emit(this.room.snapshotFor(this.clientId));
    }
  }

  emit(message) {
    if (this.onmessage) this.onmessage(message);
  }
}

