#!/usr/bin/env node
/**
 * Measures the TRUE aim direction of held guns from the character model
 * itself: composes the idle-stance bone chain (root > body > arms >
 * arm_right > hand_right > hand_right_anchor) and reads where the barrel
 * points relative to camera forward. The barrel runs along the hand
 * anchor's -Y (the fingers).
 *
 * Output: camera-space tangent offsets per stance. These are the canonical
 * constants in classes/GamePlayerEntity.ts (ONE_HANDED_AIM_TANGENT_* /
 * TWO_HANDED_AIM_TANGENT_*). Re-run whenever the idle animations change —
 * e.g. after re-exporting soldier-player.gltf from Blockbench.
 *
 *   node tools/measure-aim-offsets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODEL = path.join(here, '..', 'assets', 'models', 'players', 'soldier-player.gltf');
const BARREL_AXIS = [0, -1, 0]; // barrel in hand-anchor space

const g = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
const buf = Buffer.from(g.buffers[0].uri.split(',')[1], 'base64');

function accVals(i) {
  const a = g.accessors[i], bv = g.bufferViews[a.bufferView];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const v = [];
    for (let c = 0; c < 4; c++) v.push(buf.readFloatLE(off + (k * 4 + c) * 4));
    out.push(v);
  }
  return out;
}

/** Mean of the idle sway keys (sign-aligned, renormalized). */
function meanQuat(qs) {
  const m = [0, 0, 0, 0];
  for (const q of qs) {
    const sgn = q[3] < 0 ? -1 : 1;
    for (let i = 0; i < 4; i++) m[i] += sgn * q[i];
  }
  const l = Math.hypot(...m);
  return m.map(x => x / l);
}

const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qrot = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx];
};

const parents = {};
g.nodes.forEach((n, i) => (n.children || []).forEach(c => parents[c] = i));
const anchorIdx = g.nodes.findIndex(n => n.name === 'hand_right_anchor');
const chain = [];
let cur = anchorIdx;
while (cur !== undefined) { chain.unshift(cur); cur = parents[cur]; }

function stance(animName) {
  const a = g.animations.find(x => x.name === animName);
  if (!a) throw new Error(`animation not found: ${animName}`);
  const animRot = {};
  for (const ch of a.channels) {
    if (ch.target.path === 'rotation') {
      animRot[ch.target.node] = meanQuat(accVals(a.samplers[ch.sampler].output));
    }
  }
  let R = [0, 0, 0, 1];
  for (const ni of chain) {
    R = qmul(R, animRot[ni] ?? g.nodes[ni].rotation ?? [0, 0, 0, 1]);
  }
  const b = qrot(R, BARREL_AXIS);
  // camera-space tangents relative to model forward (-Z): x < 0 = left, y > 0 = up
  const tx = b[0] / -b[2];
  const ty = b[1] / -b[2];
  const yawDeg = Math.atan2(-b[0], -b[2]) * 180 / Math.PI;
  const pitchDeg = Math.asin(Math.max(-1, Math.min(1, b[1]))) * 180 / Math.PI;
  return { tx, ty, yawDeg, pitchDeg };
}

for (const [label, anim] of [['one-handed', 'idle_gun_right'], ['two-handed', 'idle_gun_both']]) {
  const s = stance(anim);
  console.log(
    `${label.padEnd(11)} (${anim.padEnd(14)})  ` +
    `tangent x=${s.tx.toFixed(4)} y=${s.ty.toFixed(4)}  ` +
    `(${Math.abs(s.yawDeg).toFixed(1)}deg ${s.yawDeg > 0 ? 'left' : 'right'}, ` +
    `${Math.abs(s.pitchDeg).toFixed(1)}deg ${s.pitchDeg >= 0 ? 'up' : 'down'})`,
  );
}
console.log('\nPaste the tangent values into classes/GamePlayerEntity.ts (AIM_TANGENT constants; x sign flips: left = negative there).');
