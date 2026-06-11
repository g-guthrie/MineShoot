import {
  BufferGeometry,
  Color,
  Material,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  Texture,
  Vector3,
  Vector3Like,
} from 'three';
import { ArrowId, DEFAULT_ARROW_IMAGE_PATH } from './ArrowConstants';
import ArrowStats from './ArrowStats';
import { EntityId } from '../entities/EntityConstants';
import Entity from '../entities/Entity';
import type Game from '../Game';
import Assets from '../network/Assets';
import { CustomTextureWrapper } from '../textures/CustomTextureManager';

export interface ArrowData {
  id: ArrowId;
  sourceEntityId?: EntityId;
  sourcePosition?: Vector3Like;
  targetEntityId?: EntityId;
  targetPosition?: Vector3Like;
  color?: { r: number, g: number, b: number };
  textureUri?: string;
}

const ARROW_WIDTH = 0.5;
const ARROW_UNIT_SIZE = 0.5; // World units per arrow pattern
const ANIMATION_SPEED = '2.0';
const UNIFORM_COLOR = 'color';
const UNIFORM_TIME = 'time';
const UNIFORM_LENGTH = 'length';
const UNIFORM_TEXTURE = 'map';

// Working variables
const center = new Vector3();
const scale = new Vector3();
const xAxis = new Vector3();
const yAxis = new Vector3();
const zAxis = new Vector3();

// This is intended mainly for guidance or onboarding, showing players which
// direction to move.
// Note: Assume that the texture image represents an upward-pointing arrow.
//       Also, regions with alpha values below 0.5 are cut out by alpha testing.
export class Arrow {
  private _game: Game;
  private _id: ArrowId;

  private _sourceEntityId?: number;
  private _sourcePosition?: Vector3Like;
  private _targetEntityId?: number;
  private _targetPosition?: Vector3Like;
  private _color: Color = new Color(0xffffff);
  private _texture: Texture | null = null;
  private _texturePromise: Promise<CustomTextureWrapper> | null = null;
  private _textureWrapper: CustomTextureWrapper | null = null;
  private _textureUri: string = DEFAULT_ARROW_IMAGE_PATH;
  private _mesh: Mesh<BufferGeometry, ShaderMaterial>;

  constructor(game: Game, data: ArrowData) {
    if (
      (data.sourceEntityId === undefined && data.sourcePosition === undefined) ||
      (data.sourceEntityId !== undefined && data.sourcePosition !== undefined)
    ) {
      throw new Error(`Arrow: Either sourceEntityId or targetEntityId must be specified.`);
    }

    if (
      (data.targetEntityId === undefined && data.targetPosition === undefined) ||
      (data.targetEntityId !== undefined && data.targetPosition !== undefined)
    ) {
      throw new Error(`Arrow: Either targetEntityId or targetEntityId must be specified.`);
    }

    this._game = game;
    this._id = data.id;

    this._sourceEntityId = data.sourceEntityId;
    this._sourcePosition = data.sourcePosition;
    this._targetEntityId = data.targetEntityId;
    this._targetPosition = data.targetPosition;

    if (data.color) {
      this._color.setRGB(data.color.r, data.color.g, data.color.b);
    }

    if (data.textureUri) {
      this._textureUri = Assets.toAssetUri(data.textureUri);
    }

    this._mesh = this._createMesh();
    this._game.renderer.addToScene(this._mesh);
  }

  get id(): number {
    return this._id;
  }

  private async _loadTexture(): Promise<void> {
    this._texturePromise = this._game.customTextureManager.load(this._textureUri);
    const textureWrapper = await this._texturePromise;

    if (this._texturePromise === null) {
      this._game.customTextureManager.release(textureWrapper);
      return;
    }

    this._texturePromise = null;
    this._textureWrapper = textureWrapper;
    this._texture = this._textureWrapper.texture.clone();
    this._texture.wrapT = RepeatWrapping;
    this._texture.flipY = false;

    this._mesh.material.uniforms[UNIFORM_TEXTURE].value = this._texture;
    this._mesh.material.visible = true;
  }

  private _createMesh(): Mesh<BufferGeometry, ShaderMaterial> {
    const geometry = new PlaneGeometry(1, 1);

    const material = new ShaderMaterial({
      uniforms: {
        [UNIFORM_COLOR]: { value: this._color },
        [UNIFORM_TIME]: { value: 0.0 },
        [UNIFORM_LENGTH]: { value: 1.0 },
        [UNIFORM_TEXTURE]: { value: this._texture },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 ${UNIFORM_COLOR};
        uniform float ${UNIFORM_TIME};
        uniform float ${UNIFORM_LENGTH};
        uniform sampler2D ${UNIFORM_TEXTURE};
        varying vec2 vUv;

        void main() {
          float repeatCount = ${UNIFORM_LENGTH} / ${ARROW_UNIT_SIZE};
          vec2 animatedUv = vec2(vUv.x, vUv.y * repeatCount + ${UNIFORM_TIME} * ${ANIMATION_SPEED});
          vec4 texColor = texture2D(${UNIFORM_TEXTURE}, animatedUv);
          if (texColor.a < 0.5) discard;
          gl_FragColor = vec4(texColor.rgb * ${UNIFORM_COLOR}, texColor.a);
        }
      `,
      // Limitation: There would likely be strong demand for making the arrow transparent, but it is
      // kept opaque to avoid common rendering issues with transparent objects.
      transparent: false,
      // Make it visible only after the texture becomes ready. We might consider
      // showing a placeholder until it is ready.
      visible: false,
    });

    // For now, the number of arrows used at once is assumed to be small, so each
    // arrow has its own mesh. If arrows end up being used in large quantities, we
    // may need to consider an InstancedMesh approach.
    const mesh = new Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;

    this._loadTexture();

    return mesh;
  }

  public update(deltaTimeS: number): void {
    const sourceEntity: Entity | undefined = this._sourceEntityId !== undefined ? this._game.entityManager.getEntity(this._sourceEntityId) : undefined;
    const targetEntity: Entity | undefined = this._targetEntityId !== undefined ? this._game.entityManager.getEntity(this._targetEntityId) : undefined;

    if (
      (this._sourceEntityId !== undefined && sourceEntity === undefined) ||
      (this._targetEntityId !== undefined && targetEntity === undefined)
    ) {
      // The attached entities are not found, so make the arrow invisible.
      // TODO: Should we issue a warning?
      this._mesh.visible = false;
      return;
    }

    if (sourceEntity && !sourceEntity.visible && targetEntity && !targetEntity.visible) {
      // Since both attached entities are invisible, make the arrow invisible as well.
      this._mesh.visible = false;
      return;
    }

    this._mesh.visible = true;
    ArrowStats.visibleCount++;

    const length = this._updateTransform(this._sourcePosition || sourceEntity!.position, this._targetPosition || targetEntity!.position);
    this._mesh.material.uniforms.time.value += deltaTimeS;
    this._mesh.material.uniforms.length.value = length;
  }

  private _updateTransform(start: Vector3Like, end: Vector3Like): number {
    // Scale and rotate the mesh so it connects the source and target and always
    // faces the camera.

    // If Source and TargetPosition have not changed since the previous frame, an
    // update is unnecessary. However, assuming the number of arrows is expected to
    // be small, so computing this every time should have little performance impact.

    center.lerpVectors(start, end, 0.5);
    yAxis.subVectors(end, start);
    const length = yAxis.length();
    yAxis.normalize().negate();
    zAxis.subVectors(this._game.camera.activeCamera.position, center).normalize();

    if (Math.abs(yAxis.dot(zAxis)) > 0.9999) {
      zAxis.set(0, 0, 1); // fallback when yAxis and zAxis are close to parallel
    }

    xAxis.crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    this._mesh.matrix.makeBasis(xAxis, yAxis, zAxis);
    this._mesh.matrix.setPosition(center);
    this._mesh.matrix.scale(scale.set(ARROW_WIDTH, length, 1));
    this._mesh.matrix.decompose(this._mesh.position, this._mesh.quaternion, this._mesh.scale);
    this._mesh.matrixWorld.copy(this._mesh.matrix);

    return length;
  }

  public dispose(): void {
    this._game.renderer.removeFromScene(this._mesh);
    this._mesh.geometry.dispose();
    (this._mesh.material as Material).dispose();

    if (this._texturePromise) {
      this._game.customTextureManager.cancel(this._texturePromise, true);
      this._texturePromise = null;
    }

    if (this._textureWrapper) {
      this._game.customTextureManager.release(this._textureWrapper);
      this._textureWrapper = null;
    }

    if (this._texture) {
      this._texture.dispose();
      this._texture = null;
    }
  }
}