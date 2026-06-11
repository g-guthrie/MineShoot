import {
  Entity,
} from 'hytopia';

import type GamePlayerEntity from './GamePlayerEntity';

export default abstract class InteractableEntity extends Entity {
  // Deliberately not an override of Entity.interact: the engine calls that on
  // left click/tap, which is the shoot button in this game. Interactions are
  // driven by the E key via GamePlayerEntity's raycast instead.
  public abstract interactWith(interactingPlayer: GamePlayerEntity): void;
}
