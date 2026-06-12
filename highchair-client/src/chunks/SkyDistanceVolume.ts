import type { Vector3Like } from 'three';
import { CHUNK_SIZE } from './ChunkConstants';
import { SKY_LIGHT_BRIGHTNESS_LUT } from '../blocks/BlockConstants';

type PackedIndex = { byteIndex: number, isLowNibble: boolean };

// Working variables
const packedIndex = { byteIndex: 0, isLowNibble: true };

// Stores sky distance data for a chunk using 4-bit packed storage.
// Storage mapping: 0 ~ 15 to 1 ~ 16 (direct offset by +1).
// Actual distances 1 ~ 16 are stored as 0 ~ 15 and converted back on read.
// Two distances are packed into each byte for 50% memory savings.
export default class SkyDistanceVolume {
  public readonly originCoordinate: Vector3Like;
  private _distances: Uint8Array;

  constructor(originCoordinate: Vector3Like, distances: Uint8Array) {
    this.originCoordinate = originCoordinate;
    this._distances = distances;
  }

  private _getPackedIndex(localCoordinate: Vector3Like, output: PackedIndex): PackedIndex {
    const linearIndex = localCoordinate.x + CHUNK_SIZE * (localCoordinate.y + CHUNK_SIZE * localCoordinate.z);
    output.byteIndex = Math.floor(linearIndex / 2);
    output.isLowNibble = linearIndex % 2 === 0;
    return output;
  }

  private _isValidLocalCoordinate(localCoordinate: Vector3Like): boolean {
    return (
      localCoordinate.x >= 0 && localCoordinate.x < CHUNK_SIZE &&
      localCoordinate.y >= 0 && localCoordinate.y < CHUNK_SIZE &&
      localCoordinate.z >= 0 && localCoordinate.z < CHUNK_SIZE
    );
  }

  public getSkyLightBrightness(localCoordinate: Vector3Like): number {
    if (!this._isValidLocalCoordinate(localCoordinate)) {
      throw new Error('SkyDistanceVolume.getSkyLightBrightness(): Coordinate is out of bounds');
    }

    const { byteIndex, isLowNibble } = this._getPackedIndex(localCoordinate, packedIndex);

    // Convert back: 0 ~ 15 to 1 ~ 16
    const index = (((isLowNibble) ? this._distances[byteIndex] : (this._distances[byteIndex] >> 4)) & 0x0F) + 1;
    return SKY_LIGHT_BRIGHTNESS_LUT[index];
  }
}