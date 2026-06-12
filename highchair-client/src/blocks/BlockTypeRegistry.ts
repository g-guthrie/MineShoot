import { BlockId } from './BlockConstants';
import BlockType from './BlockType';

export default class BlockTypeRegistry {
  private _blockTypes: Record<BlockId, BlockType> = {};

  public constructor() {
  }

  public registerBlockType(blockType: BlockType): void {
    this._blockTypes[blockType.id] = blockType;
  }

  public unregisterBlockType(id: BlockId): void {
    delete this._blockTypes[id];
  }

  public getBlockType(id: BlockId): BlockType | undefined {
    return this._blockTypes[id];
  }
}
