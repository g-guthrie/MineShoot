# PvP Rewrite Plan

Historical note: this file started as a branch-stage log. Current live terminology uses **Offline Sandbox** as the canonical offline mode name.

This branch starts the clean PvP rewrite around one rule:

- the server is authoritative for networked play
- the client may predict, but prediction is disposable
- Offline Sandbox remains a supported local-only mode and should share the same launch/session contracts where possible

## Stage 0

Completed in this branch:

- removed the older duplicate offline sandbox runtime path
- removed older sandbox-specific menu/UI wiring that duplicated the live shell
- removed the local-match bootstrap path from the main PvP runtime
- removed outdated sandbox-specific tests and old offline launch expectations
- removed all Demonic code, docs, tests, and alternate entry paths
- created the target top-level ownership folders

## Stage 1

Started in this branch:

- extracted gameplay session, postgame flow, resume gating, and pointer-lock lifecycle ownership into `js/app/runtime-session.js`
- reduced `js/main.js` so it consumes an app-owned session lifecycle instead of directly owning those states

## Stage 2

Started in this branch:

- extracted authoritative net room, self, match, world, input-history, snapshot, and event-queue state into `js/net/runtime-state.js`
- reduced `js/net/network.js` so mutable authoritative state no longer lives only as a wide local-variable blob
- kept the public `GameNet` surface intact as a compatibility facade while moving ownership downward

## Stage 3

Started in this branch:

- extracted runtime launch and boot ownership into `js/app/runtime-shell.js`
- reduced `js/main.js` so mode launch and runtime startup are app-owned lifecycle concerns instead of being embedded directly in the gameplay orchestrator
- reduced the networking surface so runtime state, commands, transport, and view logic live under `js/net/*`
- kept `js/net/network.js` as the live browser entrypoint while ownership moved into narrower helpers

## Stage 4

Started in this branch:

- extracted live gameplay frame stepping into `gameplay/runtime-loop.js`
- extracted live presentation and render composition into `presentation/runtime-loop.js`
- reduced `js/main.js` so the frame loop coordinates owners instead of directly owning gameplay, HUD, targeting, awareness, and rendering work in one function

## Rewrite Findings

The validated architecture findings that justify this rewrite live here:

- [docs/mayhem-rewrite-findings.md](/Users/gguthrie/Desktop/code%20bs/minecraft-fps/docs/mayhem-rewrite-findings.md)

That document is the source of truth for:

- what PvP got right and must preserve
- what PvP got wrong structurally
- the rewrite rules that replace the old architecture
- the implementation priorities for the next passes

## Immediate Acceptance Target

The first rewrite slice must satisfy this:

- from the live Pages URL, click Play
- get into a room quickly
- movement stays stable under authority
- hit registration and feedback stay authoritative and consistent

## Migration Order

1. `server`
2. `net`
3. `app`
4. `world`
5. `gameplay`
6. `presentation`
7. `rules`
8. `assets`

## Rewrite Constraints

- no gameplay ownership in `app`
- no presentation ownership in `gameplay`
- no client-only rules forks
- no duplicate offline-only ownership forks in PvP
- all multiplayer bug fixes should land on the owning module, not on adapter glue
