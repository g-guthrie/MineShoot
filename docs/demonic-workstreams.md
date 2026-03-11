# Demonic Build Workstreams

Purpose:
- Split the Demonic rebuild into independently ownable subsystem tracks.
- Keep `Mayhem` as the parity oracle while parallel agents build isolated Demonic pieces.

## Workstreams

1. `A1` App Shell
- Demonic app entry, boot routing, branding, and cross-app navigation.

2. `A2` Mode Registry
- Canonical runtime/game mode registry, sandbox derivation, and availability rules.

3. `A3` Menu UX
- Purple Pip-Boy ASCII menu, launch flow, social surfaces, loadout flow, and docs hooks.

4. `A4` Match Runtime
- Runtime coordinator, lifecycle, update loop, and subsystem wiring.

5. `A5` Player View
- Input, movement state, camera, ADS, sprint, jump, and feel parity.

6. `A6` Combat Core
- Hitscan, reload, ammo, bloom, reticle, tracer, and muzzle behavior parity.

7. `A7` Ability Runtime
- Ability targeting, cast validation, local sim, cooldowns, and network cast prep.

8. `A8` Presentation
- Actor presentation runtime, avatar rig, FX hooks, and pose state plumbing.

9. `A9` Weapons
- Weapon-first presentation schema, modular gun builder, and skin/readability surfaces.

10. `A10` World
- Biome content pipeline, world assembly, collidables, and spawn-safe structure.

11. `A11` Networking
- Transport, snapshots, self sync, remote entity sync, room/session state, and feedback sync.

12. `A12` Parity QA
- Regression harness, automated parity checks, and manual A/B approval gates.

## Rules

- No workstream mutates Mayhem behavior without explicit intent.
- New Demonic behavior should land behind Demonic-only boundaries.
- Shared contracts must be documented before multiple workstreams depend on them.
- Any gameplay divergence from Mayhem must be deliberate and tracked, not incidental.
