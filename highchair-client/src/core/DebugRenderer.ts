import { ArrowHelper, Box3, BufferAttribute, BufferGeometry, Color, Group, Line, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import EventRouter from '../events/EventRouter';
import Game from '../Game';
import { NetworkManagerEventType } from '../network/NetworkManager';
import type { NetworkManagerEventPayload } from '../network/NetworkManager';

const PLAYER_MODEL_URI = 'models/players/soldier-player.gltf';
const PLAYER_BODY_HALF_X = 0.55;
const PLAYER_BODY_HALF_Z = 0.45;
const PLAYER_BODY_HALF_HEIGHT = 0.8;
const PLAYER_HEAD_HALF_XZ = 0.36;
const PLAYER_HEAD_HALF_HEIGHT = 0.33;
const PLAYER_HEAD_CENTER_OFFSET_Y = 0.8;
const BODY_BOX_COLOR = new Color(0x58d68d);
const HEAD_BOX_COLOR = new Color(0xffd34d);
const ENTITY_BOX_COLOR = new Color(0x6ec6ff);
const lineIndices = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export default class DebugRenderer {
  private _game: Game;
  private _mesh: LineSegments;
  private _hitboxMesh: LineSegments;
  private _visible = false;

  public constructor(game: Game) {
    this._game = game;

    this._mesh = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0xffffff, vertexColors: true })
    );
    this._mesh.frustumCulled = false;
    this._mesh.visible = false;

    this._hitboxMesh = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0xffffff, vertexColors: true })
    );
    this._hitboxMesh.frustumCulled = false;
    this._hitboxMesh.visible = false;

    this._game.renderer.addToScene(this._mesh);
    this._game.renderer.addToScene(this._hitboxMesh);

    this._setupEventListeners();
    this.setVisibility(this._game.renderer.isDebugVisible);
  }

  public get game(): Game {
    return this._game;
  }

  public setVisibility(visible: boolean): void {
    this._visible = visible;
    this._mesh.visible = visible;
    this._hitboxMesh.visible = visible;

    if (!visible) {
      this._clearHitboxes();
    }
  }

  public update(): void {
    if (!this._visible) return;
    this._updateHitboxes();
  }

  private _setupEventListeners(): void {
    EventRouter.instance.on(
      NetworkManagerEventType.PhysicsDebugRaycastsPacket, 
      this._onPhysicsDebugRaycastsPacket
    );

    EventRouter.instance.on(
      NetworkManagerEventType.PhysicsDebugRenderPacket, 
      this._onPhysicsDebugRenderPacket
    );
  }

  private _onPhysicsDebugRaycastsPacket = (payload: NetworkManagerEventPayload.IPhysicsDebugRaycastsPacket) => {
    payload.deserializedPhysicsDebugRaycasts.forEach(raycast => {
      const start = new Vector3().fromArray(Object.values(raycast.origin));
      const direction = new Vector3().fromArray(Object.values(raycast.direction));
      const end = start.clone().add(direction.multiplyScalar(raycast.length));
      const color = raycast.hit ? 0xff0000 : 0x000000;

      const group = new Group().add(
        new Line(
          new BufferGeometry().setFromPoints([start, end]),
          new LineBasicMaterial({ color })
        ),
        new ArrowHelper(direction.normalize(), start, raycast.length * 0.9, color, raycast.length * 0.1, raycast.length * 0.05)
      );

      this._game.renderer.addToScene(group);

      setTimeout(() => {
        let visible = true;
        const blink = (interval = 500) => {
          group.visible = visible = !visible;
          if ((interval *= 0.9) > 50) setTimeout(() => blink(interval), interval);
          else this._game.renderer.removeFromScene(group);
        };
        blink();
      }, 2000);
    });
  }

  private _onPhysicsDebugRenderPacket = (payload: NetworkManagerEventPayload.IPhysicsDebugRenderPacket) => {
    const { vertices, colors } = payload.deserializedPhysicsDebugRender;

    this._mesh.geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    this._mesh.geometry.setAttribute('color', new BufferAttribute(colors, 4))
  }

  private _updateHitboxes(): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const tempBox = new Box3();

    for (const entity of this._game.entityManager.getAllEntities()) {
      if (!entity.visible || entity.attached || entity.isEnvironmental) continue;

      if (entity.modelUri?.includes(PLAYER_MODEL_URI)) {
        const position = entity.getWorldPosition(new Vector3());
        this._appendBox(
          positions,
          colors,
          tempBox.set(
            new Vector3(
              position.x - PLAYER_BODY_HALF_X,
              position.y - PLAYER_BODY_HALF_HEIGHT,
              position.z - PLAYER_BODY_HALF_Z
            ),
            new Vector3(
              position.x + PLAYER_BODY_HALF_X,
              position.y + PLAYER_BODY_HALF_HEIGHT,
              position.z + PLAYER_BODY_HALF_Z
            )
          ),
          BODY_BOX_COLOR
        );
        this._appendBox(
          positions,
          colors,
          tempBox.set(
            new Vector3(
              position.x - PLAYER_HEAD_HALF_XZ,
              position.y + PLAYER_HEAD_CENTER_OFFSET_Y - PLAYER_HEAD_HALF_HEIGHT,
              position.z - PLAYER_HEAD_HALF_XZ
            ),
            new Vector3(
              position.x + PLAYER_HEAD_HALF_XZ,
              position.y + PLAYER_HEAD_CENTER_OFFSET_Y + PLAYER_HEAD_HALF_HEIGHT,
              position.z + PLAYER_HEAD_HALF_XZ
            )
          ),
          HEAD_BOX_COLOR
        );
        continue;
      }

      tempBox.setFromObject(entity.entityRoot, true);
      if (!tempBox.isEmpty()) {
        this._appendBox(positions, colors, tempBox, ENTITY_BOX_COLOR);
      }
    }

    this._hitboxMesh.geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    this._hitboxMesh.geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    this._hitboxMesh.geometry.computeBoundingSphere();
  }

  private _appendBox(positions: number[], colors: number[], box: Box3, color: Color): void {
    const corners = [
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.min.y, box.min.z],
      [box.min.x, box.max.y, box.min.z],
      [box.max.x, box.max.y, box.min.z],
      [box.min.x, box.min.y, box.max.z],
      [box.max.x, box.min.y, box.max.z],
      [box.min.x, box.max.y, box.max.z],
      [box.max.x, box.max.y, box.max.z],
    ];

    for (const [start, end] of lineIndices) {
      positions.push(...corners[start], ...corners[end]);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  }

  private _clearHitboxes(): void {
    this._hitboxMesh.geometry.setAttribute('position', new BufferAttribute(new Float32Array(), 3));
    this._hitboxMesh.geometry.setAttribute('color', new BufferAttribute(new Float32Array(), 3));
  }
}
