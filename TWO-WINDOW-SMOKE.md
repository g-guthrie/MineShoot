# Two-Window Smoke Checklist

Run this after significant gameplay/network changes.

## Setup
1. Start local server or deployed URL.
2. Open two browser windows to the same URL.
3. Login as two different users (or local bypass in file mode).

## Checklist
1. **Movement boot check**
   - In each window, press `WASD`.
   - Expected: movement starts immediately; no stuck spawn.
2. **Spawn safety**
   - Kill and respawn each player 5+ times.
   - Expected: no spawn inside solids, no frozen movement.
3. **Input coherence**
   - Fire, swap weapons (`1-6`, wheel), throwables, class queue.
   - Expected: no state where shooting works but movement does not.
4. **Loadout consistency**
   - Change loadout in pause panel in window A.
   - Verify slot keys and wheel match selected order.
5. **Snapshot parity**
   - Observe each avatar from the other window.
   - Expected: weapon, pose, and movement direction match.
6. **Debug visuals**
   - Toggle `H` in each window.
   - Expected: hitboxes/ring hide/show correctly, no input break.
7. **Manual/menu**
   - Open/close field manual repeatedly while paused/unpaused.
   - Expected: clickability intact; no pointer-lock regressions.

## Pass Criteria
1. No movement lockups.
2. No spawn overlaps.
3. No equip/slot desync.
4. No snapshot parse errors in console.
