import {
  CanvasTexture,
  CompressedTexture,
  MinificationTextureFilter,
  NearestFilter,
  NearestMipMapNearestFilter,
  SRGBColorSpace,
} from 'three';
import {
  BLOCK_TEXTURE_ATLAS_PATH,
  BLOCK_TEXTURE_METADATA_PATH as BLOCK_TEXTURE_ATLAS_METADATA_PATH,
  BlockTextureAtlasEventType,
  BlockTextureUri,
  type BlockTextureAtlasMetadata,
} from './BlockConstants';
import ChunkStats from '../chunks/ChunkStats';
import EventRouter from '../events/EventRouter';
import Game from '../Game';
import Assets from '../network/Assets';
import { type ClientSettingsEventPayload, ClientSettingsEventType, DistantBlockViewMode } from '../settings/SettingsManager';
import { ChunkWorkerInitMessage, type WorkerEventPayload, WorkerEventType } from '../workers/ChunkWorkerConstants';

export default class BlockTextureAtlasManager {
  private _game: Game;
  private _canvas: HTMLCanvasElement | null = null;
  private _bitmapRenderer: ImageBitmapRenderingContext | null = null;
  private _texture: CompressedTexture | CanvasTexture | null = null;
  private _metadata: Map<BlockTextureUri, BlockTextureAtlasMetadata> = new Map();

  public constructor(game: Game) {
    this._game = game;

    EventRouter.instance.on(WorkerEventType.BlockTextureAtlasMetadata, (payload: WorkerEventPayload.IBlockTextureAtlasMetadata) => {
      const { textureUri, metadata } = payload;
      this._metadata.set(textureUri, metadata);
      ChunkStats.blockTextureCount = this._metadata.size;
    });

    EventRouter.instance.on(ClientSettingsEventType.Update, (_payload: ClientSettingsEventPayload.IUpdate) => {
      if (this._texture === null) {
        return;
      }

      const minFilter = this._getMinFilterBasedOnClientSettings(this._game);

      if (this._texture!.minFilter === minFilter) {
        return;
      }

      this._texture!.minFilter = minFilter;

      // When the version is 0, the texture data isn’t ready yet, so there’s no need to set needsUpdate = true.
      if (this._texture!.version > 0) {
        this._texture!.needsUpdate = true;
      }
    });
  }

  public async init(): Promise<void> {
    // If a pre-generated BlockTextureAtlas is not found, use the legacy mode as a
    // fallback to generate the BlockTextureAtlas dynamically. This legacy mode will
    // likely be removed in the near future.
    const textureAtlasUrl = Assets.toAssetUri(BLOCK_TEXTURE_ATLAS_PATH);

    if (await Assets.urlExists(textureAtlasUrl)) {
      await this._initCompressedTexture();
    } else {
      console.warn(`${textureAtlasUrl} is not found. Uses Legacy Block Texture Atlas mode. Upgrade SDK if not yet.`);
      this._initCanvasTexture();
    }
  }

  private async _initCompressedTexture(): Promise<void> {
    const message: ChunkWorkerInitMessage = {
      type: 'init',
      metadataUrl: Assets.toAssetUri(BLOCK_TEXTURE_ATLAS_METADATA_PATH),
    };
    this._game.chunkWorkerClient.postMessage(message);

    const assetPath = Assets.toAssetUri(BLOCK_TEXTURE_ATLAS_PATH);

    try {
      this._texture = await Assets.ktx2Loader.loadAsync(assetPath);
    } catch (error) {
      // TODO: Retry?
      console.error(error);
      throw new Error(`BlockTextureAtlasManager: Fatal Error! Failed to load ${assetPath}.`);
    }

    this._setupTexture();
    this._emitReady();
  }

  private _initCanvasTexture(): void {
    EventRouter.instance.on(WorkerEventType.BlockTextureAtlasUpdated, (payload: WorkerEventPayload.IBlockTextureAtlasUpdated) => {
      const { bitmap } = payload;

      this._canvas!.width = bitmap.width;
      this._canvas!.height = bitmap.height;
      this._bitmapRenderer!.transferFromImageBitmap(bitmap);

      this._texture!.needsUpdate = true;
    });

    const message: ChunkWorkerInitMessage = {
      type: 'init',
      metadataUrl: '', // empty strings implies using legacy mode
    };
    this._game.chunkWorkerClient.postMessage(message);

    this._canvas = document.createElement('canvas');
    // TODO: Needs error handling?
    this._bitmapRenderer = this._canvas.getContext('bitmaprenderer')!;
    this._texture = new CanvasTexture(this._canvas);
    this._setupTexture();

    // Comment out for debug to check the texture atlas contents
    //this._canvas!.style.position = 'absolute';
    //this._canvas!.style.top = '5%';
    //this._canvas!.style.left = '5%';
    //document.body.appendChild(this._canvas!);

    this._emitReady();
  }

  private _setupTexture(): void {
    this._texture!.minFilter = this._getMinFilterBasedOnClientSettings(this._game);
    this._texture!.magFilter = NearestFilter;
    this._texture!.colorSpace = SRGBColorSpace;
  }

  private _emitReady(): void {
    EventRouter.instance.emit(BlockTextureAtlasEventType.Ready, {});
  }

  public get texture(): CompressedTexture | CanvasTexture {
    return this._texture!;
  }

  public getMetadata(textureUri: BlockTextureUri): BlockTextureAtlasMetadata | undefined {
    return this._metadata.get(textureUri);
  }

  private _getMinFilterBasedOnClientSettings(game: Game): MinificationTextureFilter {
    return game.settingsManager.clientSettings.distantBlockViewMode === DistantBlockViewMode.Sharp ? NearestFilter : NearestMipMapNearestFilter;
  }
}
