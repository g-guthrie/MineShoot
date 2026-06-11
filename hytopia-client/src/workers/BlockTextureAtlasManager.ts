import type { Vector2Tuple } from 'three';
import {
  ALPHA_TEST_THRESHOLD,
  BlockTextureAtlasMetadata,
  BlockTextureAtlasMetadataJson,
  BlockTextureMetadata,
  type BlockTextureUri,
  MISSING_TEXTURE_URI,
} from '../blocks/BlockConstants';
const TEXTURE_SIZE = 24;
const TEXTURE_IMAGE_PADDING = 20;
const DEFAULT_CANVAS_SIZE = 1024;

const tmpCanvas = new OffscreenCanvas(DEFAULT_CANVAS_SIZE, DEFAULT_CANVAS_SIZE);
// TODO: Need error check?
const tmp2DContext = tmpCanvas.getContext('2d', { willReadFrequently: true })!;
tmp2DContext.imageSmoothingEnabled = false;

// TODO need to implement an event or something when the atlas resizes so that chunk uv coordinates can be recalculated
// Otherwise atlas size recalculation breaks all the prior UV coordinates

// Note:
// In the latest SDK, Block Texture Atlas is pre-generated at game startup. If no
// pre-generated Block Texture Atlas is found, fall back to the legacy method that
// dynamically generates it. Supporting this legacy mode makes the design and
// implementation somewhat awkward. We plan to clean this up when legacy mode
// support is removed. Although it is possible not to support legacy mode from
// the start, that would cause a critical issue where chunks are not displayed
// until the SDK is uploaded, which would have too much negative impact.

export abstract class BlockTextureAtlasManagerBase {
  constructor() {
  }

  public abstract getTextureUVCoordinate(textureUri: BlockTextureUri, uvOffset: Vector2Tuple): Vector2Tuple;
  public abstract isTextureTransparent(textureUri: BlockTextureUri): boolean;
  public abstract textureNeedsAlphaTest(textureUri: BlockTextureUri): boolean;
  public abstract getTransparencyRatio(textureUri: BlockTextureUri): number;
  public abstract getImageBitmap(): Promise<ImageBitmap | null>;
  public abstract loadTexture(textureUri: BlockTextureUri): Promise<BlockTextureAtlasMetadata | undefined>;
}

export class BlockTextureAtlasManagerLegacy extends BlockTextureAtlasManagerBase {
  private _canvas: OffscreenCanvas = new OffscreenCanvas(DEFAULT_CANVAS_SIZE, DEFAULT_CANVAS_SIZE);
  // TODO: Needs error handling?
  private _context: OffscreenCanvasRenderingContext2D = this._canvas.getContext('2d')!;
  private _metadata: Map<BlockTextureUri, BlockTextureAtlasMetadata> = new Map();
  private _pendings: Map<BlockTextureUri, Promise<BlockTextureAtlasMetadata>> = new Map();

  private constructor() {
    super();
    this._context.imageSmoothingEnabled = false;
  }

  public static async createInstance(): Promise<BlockTextureAtlasManagerLegacy> {
    const instance = new BlockTextureAtlasManagerLegacy();
    // TODO: Error handling, what if missing texture can't be loaded?
    await instance.loadTexture(MISSING_TEXTURE_URI);
    return instance;
  }

  public async getImageBitmap(): Promise<ImageBitmap> {
    return await createImageBitmap(this._canvas);
  }

  public getTextureUVCoordinate(textureUri: BlockTextureUri, uvOffset: Vector2Tuple): Vector2Tuple {
    const metadata = this._metadata.get(textureUri);

    if (!metadata) {
      throw new Error(`Texture metadata not found for uri: ${textureUri}`);
    }

    const atlasWidth = this._canvas.width;
    const atlasHeight = this._canvas.height;

    const imageX = metadata.x + TEXTURE_IMAGE_PADDING;
    const imageInvertedY = metadata.invertedY + TEXTURE_IMAGE_PADDING;
    const tileWidth = metadata.width - TEXTURE_IMAGE_PADDING * 2;
    const tileHeight = metadata.height - TEXTURE_IMAGE_PADDING * 2;

    // Calculate UV coordinates within atlas, taking into account texture position and size
    // Flip the V coordinate by using (1 - uvOffset[1]) to invert the texture vertically due to our
    // atlas having Y coordinates inverted from being a canvas.
    const u = (imageX + (uvOffset[0] * tileWidth)) / atlasWidth;
    const v = (atlasHeight - imageInvertedY - ((1 - uvOffset[1]) * tileHeight)) / atlasHeight;

    return [u, v];
  }

  public isTextureTransparent(textureUri: BlockTextureUri): boolean {
    if (!this._metadata.has(textureUri)) {
      throw new Error(`BlockTextureAtlas: Unknown texture uri: ${textureUri}`);
    }
    return this._metadata.get(textureUri)!.isTransparent;
  }

  public textureNeedsAlphaTest(textureUri: BlockTextureUri): boolean {
    if (!this._metadata.has(textureUri)) {
      throw new Error(`BlockTextureAtlas: Unknown texture uri: ${textureUri}`);
    }
    return this._metadata.get(textureUri)!.needsAlphaTest;
  }

  public getTransparencyRatio(_textureUri: BlockTextureUri): number {
    return 0;
  }

  private async _loadImage(imageUri: string): Promise<ImageBitmap> {
    const res = await fetch(new URL(imageUri, import.meta.url), { mode: 'cors' });
    // Some browsers return HTTP Status 0 when using non-http protocol
    // e.g. 'file://' or 'data://'. Handle as success.
    if (res.status !== 200 && res.status !== 0) {
      throw new Error(`${imageUri}: HTTP response status ${res.status}, ${res.statusText}`);
    }
    const blob = await res.blob();
    let bitmap = await createImageBitmap(blob);

    if (bitmap.width !== TEXTURE_SIZE || bitmap.height !== TEXTURE_SIZE) {
      console.warn(`Block Texture ${imageUri} size is ${bitmap.width}x${bitmap.height}. Resize to ${TEXTURE_SIZE}x${TEXTURE_SIZE}`);
      try {
        // There may be an option to call createImageBitmap() with a resize option above,
        // but due to potential processing cost and quality degradation, we
        // add the option only when needed. It might be guaranteed by spec that no resize
        // processing occurs when unnecessary, so verify this, and if so, adding the
        // resize option from the beginning may be acceptable.
        const resizedBitmap = await createImageBitmap(blob, { resizeWidth: TEXTURE_SIZE, resizeHeight: TEXTURE_SIZE, resizeQuality: 'high'});
        bitmap.close();
        bitmap = resizedBitmap;
      } catch (error) {
        console.error(error);
        // For now, even if resizing fails, it does not cause functionality issues, so
        // we ignore it. In the future, if some processing assumes a fixed size, a fallback
        // using a MISSING TEXTURE will be required.
      }
    }

    return bitmap;
  }

  // The return value indicates whether there was an update to the BlockTextureAtlas.
  // It is intended to be used for detecting whether texture data needs to be sent to WebGL texture
  // and registering metadata in main thread.
  public async loadTexture(textureUri: BlockTextureUri): Promise<BlockTextureAtlasMetadata | undefined> {
    if (this._metadata.has(textureUri)) {
      return undefined;
    }

    if (!this._pendings.has(textureUri)) {
      this._pendings.set(textureUri, new Promise(async resolve => {
        let metadata: BlockTextureAtlasMetadata;
        try {
          const image = await this._loadImage(textureUri);
          metadata = this._drawImageToAtlas(image);
        } catch (error) {
          console.error(`Failed to load texture! ${textureUri}, ${error}`);
          // If loading a Texture image fails, it's likely due to a misconfiguration
          // by the game creator. In that case, we set a MISSING TEXTURE to make the issue noticeable.
          // It also helps prevent excessive retries.
          metadata = this._metadata.get(MISSING_TEXTURE_URI)!;
        }
        this._pendings.delete(textureUri);
        this._metadata.set(textureUri, metadata);
        resolve(metadata);
      }));
    }

    return await this._pendings.get(textureUri)!;
  }

  // Draws a texture to our atlas, handling canvas resizing as needed
  // and returns the metadata for where the texture was drawn in the atlas
  // canvas.
  private _drawImageToAtlas(image: ImageBitmap): BlockTextureAtlasMetadata {
    const canvasWidth = this._canvas.width;
    const canvasHeight = this._canvas.height;
    const imageWidth = image.width;
    const imageHeight = image.height;
    const tileWidth = imageWidth + TEXTURE_IMAGE_PADDING * 2;
    const tileHeight = imageHeight + TEXTURE_IMAGE_PADDING * 2;
    const { averageRGB, hasTransparentPixel, needsAlphaTest } = this._analyzeImageContent(image);
    const metadata: BlockTextureAtlasMetadata = {
      x: 0,
      invertedY: 0,
      width: tileWidth,
      height: tileHeight,
      averageRGB,
      needsAlphaTest: needsAlphaTest,
      isTransparent: hasTransparentPixel,
    };

    // Try to find space in current canvas dimensions
    let foundSpace = false;
    const existingTextures = Array.from(this._metadata.values());

    // Check each row for available space, 
    // Scan rows from top to bottom
    for (let y = 0; y <= canvasHeight - tileHeight && !foundSpace; y++) {
      // Scan columns from left to right
      for (let x = 0; x <= canvasWidth - tileWidth; x++) {
        // Check for overlap with existing textures
        const hasOverlap = existingTextures.some(existing => 
          x < existing.x + existing.width &&
          x + tileWidth > existing.x &&
          y < existing.invertedY + existing.height &&
          y + tileHeight > existing.invertedY
        );

        if (!hasOverlap) {
          metadata.x = x;
          metadata.invertedY = y;
          foundSpace = true;
          break;
        }
      }
    }

    // If no space found, resize canvas
    if (!foundSpace) {
      // Save and restore previous content because resizing the canvas clears its contents.
      tmpCanvas.width = canvasWidth;
      tmpCanvas.height = canvasHeight;
      tmp2DContext.drawImage(this._canvas, 0, 0);

      // Double canvas size in smaller dimension
      if (canvasWidth <= canvasHeight) {
        this._canvas.width = canvasWidth * 2;
        metadata.x = canvasWidth;
        metadata.invertedY = 0;
      } else {
        this._canvas.height = canvasHeight * 2;
        metadata.x = 0;
        metadata.invertedY = canvasHeight;
      }

      this._context.drawImage(tmpCanvas, 0, 0);
    }

    // Creating TextureAtlas tiles directly from texture images causes seam-like artifacts
    // between voxels. This seems to be due to color gaps between tiles. To fix this,
    // redundant padding is added around image when generating the tile, resolving
    // the artifact issue.

    // Center (Main)
    this._context.drawImage(
      image,
      0, // sx
      0, // sy
      imageWidth, // sw
      imageHeight, // sh
      metadata.x + TEXTURE_IMAGE_PADDING, // dx
      metadata.invertedY + TEXTURE_IMAGE_PADDING, // dy
      imageWidth, // dw
      imageHeight, // dh
    );

    // Top
    this._context.drawImage(
      image,
      0, // sx
      0, // sy
      imageWidth, // sw
      1, // sh
      metadata.x + TEXTURE_IMAGE_PADDING, // dx
      metadata.invertedY, // dy
      imageWidth, // dw
      TEXTURE_IMAGE_PADDING, // dh
    );

    // Buttom
    this._context.drawImage(
      image,
      0, // sx
      imageHeight - 1, // sy
      imageWidth, // sw
      1, // sh
      metadata.x + TEXTURE_IMAGE_PADDING, // dx
      metadata.invertedY + imageHeight + TEXTURE_IMAGE_PADDING, // dy
      imageWidth, // dw
      TEXTURE_IMAGE_PADDING, // dh
    );

    // Left
    this._context.drawImage(
      image,
      0, // sx
      0, // sy
      1, // sw
      imageHeight, // sh
      metadata.x, // dx
      metadata.invertedY + TEXTURE_IMAGE_PADDING, // dy
      TEXTURE_IMAGE_PADDING, // dw
      imageHeight, // dh
    );

    // Right
    this._context.drawImage(
      image,
      imageWidth - 1, // sx
      0, // sy
      1, // sw
      imageHeight, // sh
      metadata.x + imageWidth + TEXTURE_IMAGE_PADDING, // dx
      metadata.invertedY + TEXTURE_IMAGE_PADDING, // dy
      TEXTURE_IMAGE_PADDING, // dw
      imageHeight, // dh
    );

    // Top Left
    this._context.drawImage(
      image,
      0, // sx
      0, // sy
      1, // sw
      1, // sh
      metadata.x, // dx
      metadata.invertedY, // dy
      TEXTURE_IMAGE_PADDING, // dw
      TEXTURE_IMAGE_PADDING, // dh
    );

    // Top Rght
    this._context.drawImage(
      image,
      imageWidth - 1, // sx
      0, // sy
      1, // sw
      1, // sh
      metadata.x + imageWidth + TEXTURE_IMAGE_PADDING, // dx
      metadata.invertedY, // dy
      TEXTURE_IMAGE_PADDING, // dw
      TEXTURE_IMAGE_PADDING, // dh
    );

    // Buttom Left
    this._context.drawImage(
      image,
      0, // sx
      imageHeight - 1, // sy
      1, // sw
      1, // sh
      metadata.x, // dx
      metadata.invertedY + imageHeight + TEXTURE_IMAGE_PADDING, // dy
      TEXTURE_IMAGE_PADDING, // dw
      TEXTURE_IMAGE_PADDING, // dh
    );

    // Buttom Rght
    this._context.drawImage(
      image,
      imageWidth - 1, // sx
      imageHeight - 1, // sy
      1, // sw
      1, // sh
      metadata.x + imageWidth + TEXTURE_IMAGE_PADDING, // dx
      metadata.invertedY + imageHeight + TEXTURE_IMAGE_PADDING, // dy
      TEXTURE_IMAGE_PADDING, // dw
      TEXTURE_IMAGE_PADDING, // dh
    );

    return metadata;
  }

  private _analyzeImageContent(image: ImageBitmap): {
    averageRGB: [number, number, number],
    hasTransparentPixel: boolean,
    needsAlphaTest: boolean,
  } {
    tmpCanvas.width = image.width;
    tmpCanvas.height = image.height;
    tmp2DContext.drawImage(image, 0, 0);

    // Get image data and check alpha values
    const imageData = tmp2DContext.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
    const data = imageData.data;
    let hasTransparentPixel = false;
    let needsAlphaTest = false;
    const sumRGB = [0.0, 0.0, 0.0];

    const alphaTestThreshold = 255 * ALPHA_TEST_THRESHOLD;
    // Check each pixel's alpha value, if it's less than 255 then the texture has transparency
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < sumRGB.length; j++) {
        sumRGB[j] += data[i + j];
      }
      const alpha = data[i + 3];
      hasTransparentPixel ||= alpha < 255 && alpha >= alphaTestThreshold;
      needsAlphaTest ||= alpha < alphaTestThreshold;
    }

    const pixelCount = data.length / 4;
    return {
      averageRGB: sumRGB.map(val => val / pixelCount / 255) as [number, number, number],
      hasTransparentPixel,
      needsAlphaTest,
    };
  }
}

export class BlockTextureAtlasManager extends BlockTextureAtlasManagerBase {
  private _json: BlockTextureAtlasMetadataJson;
  private _metadata: Map<BlockTextureUri, BlockTextureAtlasMetadata> = new Map();
  private _extractPathCache: Map<BlockTextureUri, BlockTextureUri> = new Map();

  constructor(json: BlockTextureAtlasMetadataJson) {
    super();
    // TODO: Need validation?
    this._json = json;
  }

  public getTextureUVCoordinate(textureUri: BlockTextureUri, uvOffset: Vector2Tuple): Vector2Tuple {
    // KTX2 textures use OpenGL convention (origin at bottom-left), so we flip the V coordinate
    // by swapping v0 and v1 compared to the metadata (which assumes top-left origin).
    // Interpolate between atlas UV bounds to support both standard blocks (0/1 corners)
    // and trimesh blocks (arbitrary UV values for proper texture mapping).
    const info = this._getTextureMetadata(textureUri);
    const u = info.u0 + uvOffset[0] * (info.u1 - info.u0);
    const v = info.v1 + uvOffset[1] * (info.v0 - info.v1);
    return [u, v];
  }

  public isTextureTransparent(textureUri: BlockTextureUri): boolean {
    return this._getTextureMetadata(textureUri).isTransparent;
  }

  public textureNeedsAlphaTest(textureUri: BlockTextureUri): boolean {
    return this._getTextureMetadata(textureUri).needsAlphaTest;
  }

  public getTransparencyRatio(textureUri: BlockTextureUri): number {
    return this._getTextureMetadata(textureUri).transparencyRatio ?? 0;
  }

  public async getImageBitmap(): Promise<null> {
    return null;
  }

  public async loadTexture(textureUri: BlockTextureUri): Promise<BlockTextureAtlasMetadata | undefined> {
    if (this._metadata.has(textureUri)) {
      return undefined;
    }

    const info = this._getTextureMetadata(textureUri);

    const metadata: BlockTextureAtlasMetadata = {
      averageRGB: [...info.averageRGB],
      needsAlphaTest: info.needsAlphaTest,
      isTransparent: info.isTransparent,
      // The following properties are used only in legacy mode, so assign arbitrary
      // placeholder values for now.
      x: 0,
      invertedY: 0,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
    };

    this._metadata.set(textureUri, metadata);

    return metadata;
  }

  private _extractPath(textureUri: string): string {
    // Note: Executing the regular expression many times may be costly, so cache the result just in case.
    if (!this._extractPathCache.has(textureUri)) {
      // Note: It is expected that "blocks/{path}" within BlockTextureUri will be used as the key.
      const matches = textureUri.match(/(?:^|\/)(blocks\/.*$)/);

      if (matches === null) {
        throw new Error(`BlockTextureAtlasManager: Fatal Error! Block Texture URI ${textureUri} is not in the expected format.`)
      }

      this._extractPathCache.set(textureUri, matches![1]);
    }
    return this._extractPathCache.get(textureUri)!;
  }

  private _getTextureMetadata(textureUri: string): BlockTextureMetadata {
    const key = this._extractPath(textureUri);
    const metadata = this._json.textures[key];

    if (metadata === undefined) {
      throw new Error(`BlockTextureAtlasManager: Fatal Error! ${key} texture is not found in Block Texture Atlas Metadata json.`)
    }

    return metadata;
  }
}