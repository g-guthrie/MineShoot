import type { Vector3Like } from 'three';
import Chunk from './Chunk';
import { CHUNK_SIZE, ChunkId } from './ChunkConstants';

// Stores light level data for a chunk using 4-bit packing.
// Each light level is stored as a 4-bit value (0-15).
// Two light levels are packed into each byte to save memory.
export default class LightLevelVolume {
  public readonly originCoordinate: Vector3Like;
  private _lightLevels: Uint8Array;

  constructor(originCoordinate: Vector3Like, lightLevels: Uint8Array) {
    this.originCoordinate = originCoordinate;
    this._lightLevels = lightLevels;
  }

  public get chunkId(): ChunkId {
    return Chunk.originCoordinateToChunkId(this.originCoordinate);
  }

  private _getIndex(localCoordinate: Vector3Like): number {
    return localCoordinate.x + CHUNK_SIZE * (localCoordinate.y + CHUNK_SIZE * localCoordinate.z);
  }

  private _getPackedIndex(index: number): { byteIndex: number; isHighNibble: boolean } {
    return {
      byteIndex: Math.floor(index / 2),
      isHighNibble: (index % 2) === 0,
    };
  }

  private _isValidLocalCoordinate(localCoordinate: Vector3Like): boolean {
    return (
      localCoordinate.x >= 0 && localCoordinate.x < CHUNK_SIZE &&
      localCoordinate.y >= 0 && localCoordinate.y < CHUNK_SIZE &&
      localCoordinate.z >= 0 && localCoordinate.z < CHUNK_SIZE
    );
  }

  public setLightLevel(localCoordinate: Vector3Like, lightLevel: number): void {
    if (!this._isValidLocalCoordinate(localCoordinate)) {
      throw new Error('LightLevelVolume.setLightLevel(): Coordinate is out of bounds');
    }

    const index = this._getIndex(localCoordinate);
    const { byteIndex, isHighNibble } = this._getPackedIndex(index);

    if (isHighNibble) {
      this._lightLevels[byteIndex] = (this._lightLevels[byteIndex] & 0x0F) | ((lightLevel & 0xF) << 4);
    } else {
      this._lightLevels[byteIndex] = (this._lightLevels[byteIndex] & 0xF0) | (lightLevel & 0xF);
    }
  }

  public getLightLevel(localCoordinate: Vector3Like): number {
    if (!this._isValidLocalCoordinate(localCoordinate)) {
      throw new Error('LightLevelVolume.getLightLevel(): Coordinate is out of bounds');
    }

    const index = this._getIndex(localCoordinate);
    const { byteIndex, isHighNibble } = this._getPackedIndex(index);

    if (isHighNibble) {
      return (this._lightLevels[byteIndex] >> 4) & 0x0F;
    } else {
      return this._lightLevels[byteIndex] & 0x0F;
    }
  }
}