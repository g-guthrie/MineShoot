import { Audio as ThreeAudio, AudioListener, PositionalAudio, Vector3 } from 'three';
import AudioStats from './AudioStats';
import Game from '../Game';
import Assets from '../network/Assets';
import type { Vector3Like } from 'three';
import { Vector3LikeMutable } from '../three/utils';

export interface AudioData {
  id: number;
  uri?: string;
  loop?: boolean;
}

const DISTANCE_MODEL = 'linear';
const ROLLOFF_FACTOR = 1;
const NO_DISTORTION = 0;
const NO_CUTOFF_DISTANCE = 0;
// The default maxDistance of a WebAudio Panner is a very large value
// (10000). If maxDistance is not explicitly set, distance-based attenuation
// from positional effects is hard to notice. Therefore, set a default maxDistance value.
const DEFAULT_CUTOFF_DISTANCE = 50;

const Cache = new Map<string /* uri */, Promise<AudioBuffer>>();

// Updating the position of PositionalAudio seems to be slow, so we try to
// adjust the update frequency to a more appropriate level.

// If the attached Entity does not appear to have moved much, do not update
// the position of the PositionalAudio.
const MIN_UPDATE_DISTANCE = 0.2;
const MIN_UPDATE_DISTANCE_SQUARED = MIN_UPDATE_DISTANCE * MIN_UPDATE_DISTANCE;

// Adjust the update frequency based on distance. For distant objects, a
// lower update frequency is likely not noticeable.
// Note: This is based on the assumption that, in terms of perceived
// experience, updating the position of PositionalAudio every frame is
// likely unnecessary in the first place.
// Note: For natural-sounding PositionalAudio quality, it is probably better to
// control updates by elapsed time. However, doing so would increase the
// update frequency on low-end devices when FPS is low.
// To prioritize performance, updates are controlled by frame interval.
const MIN_UPDATE_FRAME_INTERVAL = 4;  // Minimum 4 frames between updates (even for nearby audio)
const MAX_UPDATE_FRAME_INTERVAL = 20; // Maximum 20 frames between updates (for distant audio)
const AUDIO_NEAR_DISTANCE = 16;       // Audio within this distance uses minimum interval

// Working variables
const vec3 = new Vector3();

export default class Audio {

  private _game: Game;
  private _id: number;
  private _listener: AudioListener;
  
  // Audio metadata (always kept and updated)
  private _uri: string | undefined;
  private _loop: boolean = false;
  private _attachedToEntityId: number | undefined;
  private _position: Vector3LikeMutable | undefined;
  private _volume: number | undefined;
  private _playbackRate: number | undefined;
  private _detune: number | undefined;
  private _offset: number | undefined;
  private _cutoffDistance: number = DEFAULT_CUTOFF_DISTANCE;
  private _referenceDistance: number | undefined;
  private _startTick: number = 0;
  private _distortion: number = NO_DISTORTION;
  
  // Audio state tracking
  private _isPaused: boolean = false;
  private _shouldPlay: boolean = false;
  
  // Three.js Audio node (heavy, lazily created/disposed)
  private _audioNode: ThreeAudio<GainNode | PannerNode> | undefined;
  private _createdAt: number = 0;

  public constructor(game: Game, listener: AudioListener, data: AudioData) {
    this._game = game;
    this._id = data.id;
    this._listener = listener;
    
    this._uri = data.uri;
    this._loop = data.loop || false;
  }

  public get id(): number { return this._id; }
  public get attachedToEntityId(): number | undefined { return this._attachedToEntityId; }
  public get hasActiveNode(): boolean { return this._audioNode !== undefined; }
  public get isPlaying(): boolean { return this._shouldPlay && !this._isPaused; }
  public get createdAt(): number { return this._createdAt; }

  public disposeAudioNode(): void {
    if (!this._audioNode) return;

    try {
      this._audioNode.stop();
      this._audioNode.disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }

    this._audioNode = undefined;
  }

  public play(): void {
    // Ignore old one-shot audio that may have started a while ago.
    // The server ticks at 60hz, so 180 tick buffer is 3 seconds.
    // This solves an issue where a user may receive all audio in a game on
    // join but the audio is playing from a while ago. If we were to play all of
    // them on join, it would be an extremely loud and jarring experience of audio.
    if (!this._loop && this._startTick < this._game.networkManager.lastPacketServerTick - 180) return;
    
    this._shouldPlay = true;
    this._isPaused = false;
    
    if (this._audioNode) {
      this._reconnectAndPlay();
    } else {
      this._ensureAudioNodeAndPlay();
    }
  }

  public pause(): void {
    this._isPaused = true;
    // Don't change _shouldPlay - paused audio should remember it was told to play
    
    if (this._audioNode) {
      this._audioNode.pause();
    }
  }

  public restart(): void {
    this._shouldPlay = true;
    this._isPaused = false;
    
    if (this._audioNode) {
      this._audioNode.stop();
      this._reconnectAndPlay();
    } else {
      this._ensureAudioNodeAndPlay();
    }
  }

  // Synchronous setters following Light pattern
  public setVolume(volume: number): void {
    if (this._volume === volume) {
      return;
    }

    this._volume = volume;

    if (this._audioNode) {
      this._applyVolume(this._audioNode.isPlaying === false);
    }
  }

  private _applyVolume(immediately: boolean): void {
    if (immediately) {
      this._audioNode!.gain.gain.value = this._volume!;
    } else {
      this._audioNode!.setVolume(this._volume!);
    }
  }

  public setPlaybackRate(rate: number): void {
    if (this._playbackRate === rate) {
      return;
    }

    this._playbackRate = rate;

    if (this._audioNode) {
      this._applyPlaybackRate();
    }
  }

  private _applyPlaybackRate(): void {
    this._audioNode!.setPlaybackRate(this._playbackRate!);
  }

  public setDetune(detune: number): void {
    if (this._detune === detune) {
      return;
    }

    this._detune = detune;

    if (this._audioNode) {
      this._applyDetune();
    }
  }

  private _applyDetune(): void {
    this._audioNode!.setDetune(this._detune!);
  }

  public setOffset(offset: number): void {
    if (this._offset === offset) {
      return;
    }

    this._offset = offset;

    if (this._audioNode) {
      this._applyOffset();
    }
  }

  private _applyOffset(): void {
    this._audioNode!.offset = this._offset!;
  }

  public setDistortion(amount: number): void {
    if (this._distortion === amount) {
      return;
    }

    this._distortion = amount;

    if (this._audioNode) {
      this._applyDistortion();
    }
  }

  private _applyDistortion(): void {
    if (this._distortion === NO_DISTORTION) {
      this._audioNode!.setFilters([]);
    } else {
      const filter = this._createDistortionFilter(this._audioNode!, this._distortion);
      this._audioNode!.setFilter(filter);
    }
  }

  public setAttachedToEntityId(entityId: number): void {
    if (this._attachedToEntityId === entityId) {
      return;
    }

    this._attachedToEntityId = entityId;
    this._position = undefined;
    
    if (this._audioNode instanceof PositionalAudio) {
      // If audio is currently playing, apply parameter changes gradually to
      // avoid noise. Otherwise, apply the parameters immediately so they take
      // effect even if playback starts right after.
      // Same for similar parts.
      this._applyEntityAttachedPosition(this._audioNode.isPlaying === false);
    } else if (this._audioNode) {
      console.warn(`Audio ${this._id}: Cannot set attached entity - audio is not positional`);
    }
  }

  public setPosition(position: Vector3Like): void {
    if (this._position && this._position.x === position.x && this._position.y === position.y && this._position.z === position.z) {
      return;
    }

    if (this._position) {
      this._position.x = position.x;
      this._position.y = position.y;
      this._position.z = position.z;  
    } else {
      this._position = { ...position };
    }

    this._attachedToEntityId = undefined;

    if (this._audioNode instanceof PositionalAudio) {
      this._applyPosition(this._audioNode.isPlaying === false);
    } else if (this._audioNode) {
      console.warn(`Audio ${this._id}: Cannot set position - audio is not positional`);
    }
  }

  public setCutoffDistance(distance: number): void {
    if (distance === NO_CUTOFF_DISTANCE) {
      // It seems that a value of 0 may be sent from the server when
      // cutoffDistance is not explicitly set, so a guard is added here.
      // Ideally, this should be fixed on the server side.
      return;
    }

    if (this._cutoffDistance === distance) {
      return;
    }

    this._cutoffDistance = distance;

    if (this._audioNode instanceof PositionalAudio) {
      this._applyCutoffDistance();
    } else if (this._audioNode) {
      console.warn(`Audio ${this._id}: Cannot set cutoff distance - audio is not positional`);
    }
  }

  private _applyCutoffDistance(): void {
    const audioNode = this._audioNode as PositionalAudio;
    audioNode.setDistanceModel(DISTANCE_MODEL);
    audioNode.setMaxDistance(this._cutoffDistance);
    audioNode.setRolloffFactor(ROLLOFF_FACTOR);
  }

  public setReferenceDistance(distance: number): void {
    if (this._referenceDistance === distance) {
      return;
    }

    this._referenceDistance = distance;

    if (this._audioNode instanceof PositionalAudio) {
      this._applyReferenceDistance();
    } else if (this._audioNode) {
      console.warn(`Audio ${this._id}: Cannot set reference distance - audio is not positional`);
    }
  }

  private _applyReferenceDistance(): void {
    const audioNode = this._audioNode as PositionalAudio;
    audioNode.setDistanceModel(DISTANCE_MODEL);
    audioNode.setRefDistance(this._referenceDistance!);
    audioNode.setRolloffFactor(ROLLOFF_FACTOR);
  }

  public setStartTick(tick: number): void {
    this._startTick = tick;
  }

  // This method is called immediately after the audio data is loaded,
  // before playback starts, so the "immediately" argument = true is used.
  private _applyAllProperties(): void {
    // Apply basic properties
    if (this._volume !== undefined) {
      this._applyVolume(true);
    }

    if (this._playbackRate !== undefined) {
      this._applyPlaybackRate();
    }

    if (this._detune !== undefined) {
      this._applyDetune();
    }

    if (this._offset !== undefined) {
      this._applyOffset();
    }

    if (this._distortion !== NO_DISTORTION) {
      this._applyDistortion();
    }

    // Apply positional properties
    if (this._audioNode instanceof PositionalAudio) {
      this._applyCutoffDistance();

      if (this._referenceDistance !== undefined) {
        this._applyReferenceDistance();
      }

      // Apply position or entity attachment
      if (this._attachedToEntityId !== undefined) {
        this._applyEntityAttachedPosition(true);
      } else if (this._position !== undefined) {
        this._applyPosition(true);
      }
    }
  }

  private _reconnectAndPlay(): void {
    if (!this._audioNode) return;

    // Re-apply position/attachment
    if (this._attachedToEntityId !== undefined) {
      this._applyEntityAttachedPosition(this._audioNode.isPlaying === false);
    } else if (this._position !== undefined) {
      this._applyPosition(this._audioNode.isPlaying === false);
    }

    this._audioNode.play();
  }

  private _stopAndDisconnect(): void {
    if (!this._audioNode) return;
    
    try {
      this._audioNode.stop();
      // Keep the WebAudio node alive, just disconnect from scene
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private _ensureAudioNodeAndPlay(): void {
    if (this._audioNode || !this._uri) return;

    this._loadAudio(this._uri).then(audioBuffer => {
      // Create appropriate audio type
      this._audioNode = this._attachedToEntityId !== undefined || this._position !== undefined
        ? new PositionalAudio(this._listener)
        : new ThreeAudio(this._listener);

      this._createdAt = Date.now();

      // Set buffer and loop
      this._audioNode.setBuffer(audioBuffer);
      this._audioNode.setLoop(this._loop);

      // Apply all stored properties
      this._applyAllProperties();

      // Auto-disconnect when finished (if not looping)
      if (!this._loop) {
        this._audioNode.onEnded = () => {
          this._shouldPlay = false; // Reset play intention when audio ends
          this._stopAndDisconnect();
        };
      }

      // Handle pending play state
      if (this._shouldPlay && !this._isPaused) {
        this._audioNode.play();
      }
    }).catch(error => {
      console.warn(`Audio ${this._id}: Failed to load audio:`, error);
    });
  }

  private _applyEntityAttachedPosition(immediately: boolean): void {
    const entity = this._game.entityManager.getEntity(this._attachedToEntityId!);
    if (!entity) {
      console.warn(`Audio._applyEntityAttachedPosition(): Attached entity ${this._attachedToEntityId} not found for Audio ${this._id}.`);
      return;
    }

    // Note that obtaining the world position is costly when attached to a
    // child Entity. It may be worth considering disabling attachment to child Entities.
    this._updatePositionalAudioPosition(entity.getWorldPosition(vec3), immediately);
  }

  private _applyPosition(immediately: boolean): void {
    this._updatePositionalAudioPosition(this._position as Vector3Like, immediately);
  }

  private _updatePositionalAudioPosition(position: Vector3Like, immediately: boolean): void {
    const audioNode = this._audioNode as PositionalAudio;

    // Note: For now, directional PositionalAudio is not supported, so only the
    // position is updated. When directional PositionalAudio is supported,
    // rotation updates will also be needed.

    audioNode.position.copy(position);

    // Since Audio is not added to the Scene, even matrix updates are unnecessary.
    // Execute the WebAudio API directly for finer control and more granular
    // optimizations.

    // TODO: Frequently updating a Panner's position when audio is not playing seems
    // to incur a large CPU cost on some platforms. For update requests while
    // audio is not playing, it may be better to store the request and apply
    // only the latest parameters right before playback starts.

    if (audioNode.panner.positionX) {
      if (!immediately) {
        const endTime = audioNode.context.currentTime + audioNode.listener.timeDelta;
        audioNode.panner.positionX.linearRampToValueAtTime(position.x, endTime);
        audioNode.panner.positionY.linearRampToValueAtTime(position.y, endTime);
        audioNode.panner.positionZ.linearRampToValueAtTime(position.z, endTime);
      } else {
        audioNode.panner.positionX.value = position.x;
        audioNode.panner.positionY.value = position.y;
        audioNode.panner.positionZ.value = position.z;
      }
    } else {
      audioNode.panner.setPosition(position.x, position.y, position.z);
    }

    // TODO: Rename
    AudioStats.matrixUpdateCount++;
  }

  private _createDistortionFilter(audio: ThreeAudio<GainNode | PannerNode>, amount: number): WaveShaperNode {
    const distortion = audio.context.createWaveShaper();
    const curve = new Float32Array(44100);
    
    for (let i = 0; i < 44100; i++) {
      const x = (i * 2) / 44100 - 1;
      curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 1 / (amount + 1));
    }
    
    distortion.curve = curve;
    
    return distortion;
  }

  private async _loadAudio(audioUri: string): Promise<AudioBuffer> {
    if (!audioUri) return Promise.reject('No audio URI provided');

    // TODO: Cache release support?
    // TODO: Retry and/or Fallback support when error happens?

    if (!Cache.has(audioUri)) {
      Cache.set(audioUri, new Promise((resolve, reject) => {
        Assets.audioLoader.load(Assets.toAssetUri(audioUri), buffer => {
          resolve(buffer);
        }, undefined, reject);
      })); 
    }

    return await Cache.get(audioUri)!;
  }

  // Make a playing PositionalAudio attached to an Entity follow that Entity's position.
  public update(frameCount: number): void {
    if (
      !(this._audioNode instanceof PositionalAudio) ||
      this._audioNode?.isPlaying !== true ||
      this._attachedToEntityId === undefined
    ) {
      return;
    }

    const entity = this._game.entityManager.getEntity(this._attachedToEntityId);
    if (!entity) {
      // It is likely that the attached Entity was deleted first. In that case,
      // it would be a natural behavior to stop moving the PositionalAudio.
      return;
    }

    // Note that obtaining the world position is costly when attached to a
    // child Entity. It may be worth considering disabling attachment to child Entities.
    entity.getWorldPosition(vec3);

    if (!this._shouldUpdateEntityAttachedPosition(vec3, frameCount)) {
      AudioStats.matrixUpdateSkipCount++;
      return;
    }

    this._updatePositionalAudioPosition(vec3, false);
  }

  // Note: Caller's responsibility to ensure this._audioNode is ready
  // Note: position must be immutable in this method
  private _shouldUpdateEntityAttachedPosition(position: Vector3, frameCount: number): boolean {
    // TODO: Should we increase how frequently we update positional audio attached to the Player Entity?

    // Check if movement distance is significant enough
    if (position.distanceToSquared(this._audioNode!.position) < MIN_UPDATE_DISTANCE_SQUARED) {
      return false;
    }

    const cameraPos = this._game.camera.activeCamera.position;
    const distance = cameraPos.distanceTo(position);
    const updateInterval = this._calculateUpdateInterval(distance);

    // To distribute which frames perform updates, add the id and then apply a modulo calculation.
    return (frameCount + this._id) % updateInterval === 0;
  }

  private _calculateUpdateInterval(distanceToCamera: number): number {
    if (distanceToCamera <= AUDIO_NEAR_DISTANCE) {
      return MIN_UPDATE_FRAME_INTERVAL;
    }

    // Use viewDistance as far threshold
    const viewDistance = this._game.renderer.viewDistance || 1000;

    if (distanceToCamera >= viewDistance) {
      return MAX_UPDATE_FRAME_INTERVAL;
    }

    // Linear interpolation for intermediate distances
    const ratio = (distanceToCamera - AUDIO_NEAR_DISTANCE) / (viewDistance - AUDIO_NEAR_DISTANCE);

    return Math.floor(
      MIN_UPDATE_FRAME_INTERVAL + 
      ratio * (MAX_UPDATE_FRAME_INTERVAL - MIN_UPDATE_FRAME_INTERVAL)
    );
  }
}