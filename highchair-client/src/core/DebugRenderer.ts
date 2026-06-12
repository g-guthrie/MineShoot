import { ArrowHelper, BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import EventRouter from '../events/EventRouter';
import Game from '../Game';
import { NetworkManagerEventType } from '../network/NetworkManager';
import type { NetworkManagerEventPayload } from '../network/NetworkManager';

export default class DebugRenderer {
  private _game: Game;
  private _mesh: LineSegments;

  public constructor(game: Game) {
    this._game = game;

    this._mesh = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0xffffff, vertexColors: true })
    );
    this._mesh.frustumCulled = false;

    this._game.renderer.addToScene(this._mesh);

    this._setupEventListeners();
  }

  public get game(): Game {
    return this._game;
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
}