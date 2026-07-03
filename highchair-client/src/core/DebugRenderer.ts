import { ArrowHelper, Box3, BufferAttribute, BufferGeometry, Color, Group, Line, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import EventRouter from '../events/EventRouter';
import Game from '../Game';
import { NetworkManagerEventType } from '../network/NetworkManager';
import type { NetworkManagerEventPayload } from '../network/NetworkManager';

const PLAYER_MODEL_URI = 'models/players/soldier-player.gltf';
// Canonical player hitboxes — MUST mirror PLAYER_HITBOX in
// highchair-game/gameConfig.ts. These are the exact volumes bullets test
// against on the server: an axis-aligned body box (feet to head-base) and
// a head box poking a bit above the model, sized as fractions of entity
// height so they scale with the character.
const PLAYER_HEIGHT = 3.71; // soldier-player at modelScale 1.22 (probe-measured)
const HITBOX_BODY_HALF_WIDTH_FRAC = 0.369;
const HITBOX_BODY_TOP_FRAC = 0.75;
const HITBOX_HEAD_HALF_WIDTH_FRAC = 0.268;
const HITBOX_HEAD_TOP_FRAC = 1.1;
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
      // depthTest off: the boxes hug the model, so depth-tested lines were
      // swallowed by the body while standing (only visible on corpses).
      new LineBasicMaterial({ color: 0xffffff, vertexColors: true, depthTest: false, transparent: true })
    );
    this._hitboxMesh.frustumCulled = false;
    this._hitboxMesh.renderOrder = 50;
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

    // Your own hitbox wraps the camera and just obscures the view.
    const localEntity = this._game.camera.gameCameraAttachedEntity;

    for (const entity of this._game.entityManager.getAllEntities()) {
      if (!entity.visible || entity.attached || entity.isEnvironmental) continue;
      if (entity === localEntity) continue;

      if (entity.modelUri?.includes(PLAYER_MODEL_URI)) {
        const center = entity.getWorldPosition(new Vector3());
        const feetY = center.y - PLAYER_HEIGHT / 2;
        const bodyHalf = PLAYER_HEIGHT * HITBOX_BODY_HALF_WIDTH_FRAC;
        const headHalf = PLAYER_HEIGHT * HITBOX_HEAD_HALF_WIDTH_FRAC;
        const splitY = feetY + PLAYER_HEIGHT * HITBOX_BODY_TOP_FRAC;

        this._appendBox(positions, colors, tempBox.set(
          new Vector3(center.x - bodyHalf, feetY, center.z - bodyHalf),
          new Vector3(center.x + bodyHalf, splitY, center.z + bodyHalf)
        ), BODY_BOX_COLOR);
        this._appendBox(positions, colors, tempBox.set(
          new Vector3(center.x - headHalf, splitY, center.z - headHalf),
          new Vector3(center.x + headHalf, feetY + PLAYER_HEIGHT * HITBOX_HEAD_TOP_FRAC, center.z + headHalf)
        ), HEAD_BOX_COLOR);
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
