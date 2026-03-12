# Mayhem Rewrite Findings

This document captures the major issues that justified the clean Mayhem rewrite, what the current game got right, and what the rewrite must preserve while fixing the internals.

These are architecture findings, not optional ideas.

## 1. Runtime and Game Lifecycle Is Monolithic

Mayhem got right:
- It launches into a playable game.
- Menu, launch, gameplay, and return-to-menu all exist.
- The product behavior is real.

Mayhem got wrong:
- Too much lifecycle ownership lives in [js/main.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/main.js).
- Launch flow, session state, pointer lock, postgame, runtime boot, and orchestration are tangled together.
- Lifecycle ownership is hard to identify or test in isolation.

Rewrite rule:
- Split lifecycle into explicit owners for shell, runtime loader, session, match runtime, and coordinator.
- Keep gameplay runtime separate from menu shell.
- Make launch and return-to-menu explicit contracts.

## 2. Networking Ownership Is Too Diffuse

Mayhem got right:
- It has a real authoritative multiplayer lane.
- It sends sequenced input, ingests snapshots, and reconciles state.
- It proves the browser multiplayer model works.

Mayhem got wrong:
- `GameNet` is too broad.
- Connection lifecycle, transport, selectors, remote entities, notices, and sync logic are spread across too many modules.
- `runtime-access.js` drifted into hidden dependency injection.

Rewrite rule:
- One transport owner.
- One net runtime owner.
- One state-view owner.
- One input-history owner.
- Coordinator reads from net; net must not secretly own the whole game.

## 3. Local Prediction vs Authoritative Truth Is Not Explicit Enough

Mayhem got right:
- It understands server authority.
- It tracks acked and pending input.
- It attempts proper reconciliation.

Mayhem got wrong:
- The line between local predicted state and authoritative state is not explicit enough.
- Too much gameplay code can indirectly affect what should be server-owned truth.

Rewrite rule:
- Server-owned self state comes only from authoritative room messages.
- Predicted local state is explicit and separate.
- Reconciliation is triggered through a narrow contract.

## 4. Movement and Reconciliation Path Is Hard To Reason About

Mayhem got right:
- Shared authoritative movement and replay logic are the right idea.
- Replaying pending inputs from authoritative snapshots is the correct multiplayer model.

Mayhem got wrong:
- Motion sync is entangled with self-sync, combat state, and broader runtime glue.
- The exact correction path is hard to isolate.

Rewrite rule:
- Shared helpers own replay math.
- Player runtime owns motion application.
- Net runtime owns authoritative self snapshots and pending inputs.
- Coordinator only wires those pieces together.

## 5. Self Combat State Is Mixed With Old UI and Global Runtime Assumptions

Mayhem got right:
- One place owns HP, armor, invulnerability, and respawn.
- Multiplayer sync of self survivability state exists.

Mayhem got wrong:
- Local and multiplayer concerns are mixed.
- The survivability contract is tied to the old global UI/runtime model.

Rewrite rule:
- Create a dedicated self-combat runtime for HP, armor, alive, invulnerable, and respawn countdown.
- Net owns authoritative self data.
- HUD reads self-combat state, not raw networking internals.

## 6. Weapon, Ammo, and Reload State Is Not Cleanly Owned

Mayhem got right:
- Server already owns weapon and ammo truth.
- Equip is explicit.
- Reload comes back via authoritative self snapshot.

Mayhem got wrong:
- Send logic, server handling, local weapon presentation, and ammo sync are spread across too many layers.

Rewrite rule:
- Net runtime owns equip and loadout transport.
- Combat runtime owns local weapon-state presentation.
- Server remains source of truth for ammo and reload.
- Authoritative weapon state syncs back cleanly into combat runtime.

## 7. Fire and Hit Confirmation Path Is Structurally Messy

Mayhem got right:
- Local fire feel is immediate.
- Server owns real damage and death.
- Shared hitscan authority already exists.

Mayhem got wrong:
- Fire payload construction, client feel, server truth, and incoming hit feedback are structurally scattered.

Rewrite rule:
- Local fire feel remains local.
- Net runtime owns fire request transport and incoming hit, damage, and death messages.
- Combat runtime stays presentation-oriented, not network-owned.

## 8. Ability Networking Is Scattered

Mayhem got right:
- Server decides whether a cast succeeds.
- Protocol already supports request, ok/reject, event, and loadout changes.
- Predicted local commit exists.

Mayhem got wrong:
- Input prep, send, local commit, result handling, and feedback sync are structurally scattered.

Rewrite rule:
- Net runtime owns cast transport and incoming cast and event messages.
- Ability runtime owns loadout, cooldowns, targeting, and predicted cast prep.
- Coordinator bridges local trigger to network send to predicted commit.

## 9. Throwable Networking Is a Giant Mixed System

Mayhem got right:
- Throws are server-authoritative.
- Predicted throws exist for feel.
- There is a full protocol for throw ack/reject/projectiles/fire-zones/events.

Mayhem got wrong:
- Inventory state, prediction, reconciliation, projectile rendering, and network event effects are mixed into one huge owner plus glue.

Rewrite rule:
- Net owns throw transport, queues, and authoritative projectile, fire-zone, and self-throwable data.
- Throwable runtime owns selected throwable, predicted throws, and inventory sync.
- Throwable presentation owns visuals.
- Coordinator bridges the full throw flow.

## 10. Remote Entity Rendering Is Too Coupled To Old Runtime Globals

Mayhem got right:
- Remote players and bots are real scene objects.
- Server snapshot schema already has the right data.
- Remote presence works.

Mayhem got wrong:
- Remote rendering is tightly coupled to old actor factories and global runtime systems.
- Networking and presentation are too entangled.

Rewrite rule:
- Net runtime and state-view own canonical remote entity data.
- Presentation owns remote visuals.
- Scene composes the result.

## 11. Menu Shell and Gameplay Surface Are Too Intertwined

Mayhem got right:
- The menu gets the player into the game.
- The product handoff is real.

Mayhem got wrong:
- Menu, runtime, and postgame state are too intertwined.
- UI ownership by phase is hard to identify.

Rewrite rule:
- Shell owns menu intent and launch chrome.
- Runtime owns gameplay.
- Session owns phase.
- Match runtime owns the live game.
- Shell and runtime host are sibling surfaces, not one giant entangled owner.

## 12. Gameplay Focus and Pointer Lock Are Buried In A Giant Blob

Mayhem got right:
- Pointer lock is part of live gameplay entry.
- Third-person camera still uses locked mouse-look correctly.
- The app distinguishes menu presence from gameplay input capture.

Mayhem got wrong:
- Launch flow, input capture, postgame, and resume behavior are tangled together.

Rewrite rule:
- Input bindings own focus gating.
- Runtime scene owns the pointer-lock target.
- Shell owns explicit entry UI.
- Coordinator passes the correct target into bindings.

## 13. Enter-Match Handoff Is Buried Instead Of Owned

Mayhem got right:
- There is a clear enter-match gesture.
- Pointer lock is requested from a real user action.
- The game distinguishes runtime existence from player entry.

Mayhem got wrong:
- The handoff is buried inside the main orchestration path.

Rewrite rule:
- Make `ENTER MATCH` an explicit shell/runtime contract.
- Expose `hasGameplayFocus` and `enterControlMode`.
- Preserve the same player-facing behavior without the orchestration blob.

## 14. In-Match Presentation Still Carries Harness and Debug Feel

Mayhem got right:
- Once in a match, the match is the primary visual surface.
- Debug state does not dominate the visual hierarchy.

Mayhem got wrong:
- It achieves that through entanglement instead of clean shell/runtime ownership.

Rewrite rule:
- Runtime host dominates the screen.
- Shell becomes minimal live chrome.
- Debug info is optional and collapsed by default.

## 15. Boot Order and Initialization Are Fragile

Mayhem got right:
- The app still boots into something usable.

Mayhem got wrong:
- Initialization depends on globals and ordering assumptions.
- Menu and runtime systems are sensitive to boot sequence.

Rewrite rule:
- Create explicit initialization boundaries.
- Shell renders only after its dependencies are registered.
- Runtime loader only owns bundle readiness, not business logic.

## 16. Shared Code Boundaries Were Not Strict Enough

Mayhem got right:
- Shared contracts do exist and are useful:
  protocol, tuning, movement math, reconciliation, and mode registry.

Mayhem got wrong:
- Shared boundaries drifted into secret reuse of old runtime ownership.

Rewrite rule:
- Shared is only for canonical truths:
  protocol, tuning, mode registry, deterministic helpers, and backend contracts.
- Runtime, client, gameplay, and presentation implementations own themselves.

## 17. The Biggest Strategic Issue

Mayhem got right:
- The feel is good.
- The game loop is compelling.
- The browser multiplayer concept is already proven enough to preserve.

Mayhem got wrong:
- Every iteration risks breaking the live game.
- Ownership confusion makes networking and gameplay debugging expensive.
- The code is hard to evolve safely.

Rewrite rule:
- Preserve the exact player-facing behavior where it matters.
- Replace the internals with explicit ownership and clean subsystem boundaries.
- Keep the feel while making the codebase maintainable.

## Implementation Priorities Derived From These Findings

1. Break lifecycle ownership out of [js/main.js](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/js/main.js).
2. Narrow `net` ownership into transport, runtime, state-view, and input-history.
3. Make authoritative self state, predicted self state, and reconciliation explicit.
4. Split self combat, weapon state, abilities, and throwables into narrow owners with net as transport only.
5. Move remote entity truth to net/state-view and keep rendering in presentation only.
6. Reduce shell responsibilities to menu, launch, focus handoff, and minimal live chrome.
