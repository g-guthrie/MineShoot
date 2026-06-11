/**
 * effects.js - Short-lived combat visuals: tracers and impact puffs.
 */
const THREE = globalThis.THREE;

let muzzleTexture = null;

/** Procedural starburst texture: hot white core, orange spikes, soft falloff. */
export function getMuzzleTexture() {
  if (muzzleTexture) return muzzleTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;

  ctx.translate(cx, cx);
  // Spikes: long thin triangles at irregular angles.
  const spikes = 9;
  for (let i = 0; i < spikes; i++) {
    const angle = (i / spikes) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
    const len = cx * (i % 2 ? 0.95 : 0.6);
    const halfWidth = cx * 0.07;
    const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
    gradient.addColorStop(0, 'rgba(255,235,180,0.95)');
    gradient.addColorStop(0.5, 'rgba(255,160,60,0.55)');
    gradient.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle + Math.PI / 2) * halfWidth, Math.sin(angle + Math.PI / 2) * halfWidth);
    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.lineTo(Math.cos(angle - Math.PI / 2) * halfWidth, Math.sin(angle - Math.PI / 2) * halfWidth);
    ctx.closePath();
    ctx.fill();
  }
  // Hot core.
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, cx * 0.4);
  core.addColorStop(0, 'rgba(255,255,240,1)');
  core.addColorStop(0.35, 'rgba(255,220,140,0.9)');
  core.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, cx * 0.4, 0, Math.PI * 2);
  ctx.fill();

  muzzleTexture = new THREE.CanvasTexture(canvas);
  return muzzleTexture;
}

export function createEffects(scene) {
  const live = [];

  // One shared flash light, moved to whichever muzzle fired last.
  const flashLight = new THREE.PointLight(0xffa850, 0, 11, 1.8);
  scene.add(flashLight);

  function addMuzzleFlash(point, scale = 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getMuzzleTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      rotation: Math.random() * Math.PI * 2
    }));
    sprite.scale.setScalar((0.55 + Math.random() * 0.25) * scale);
    sprite.position.set(point.x, point.y, point.z);
    scene.add(sprite);
    live.push({ object: sprite, age: 0, ttl: 0.05, fade: true, grow: 5 });

    flashLight.position.set(point.x, point.y, point.z);
    flashLight.intensity = 26 * scale;
  }

  function addTracer(from, to, color = 0xffe9a8) {
    const points = [
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    live.push({ object: line, age: 0, ttl: 0.07, fade: true });
  }

  function addImpact(point, color = 0xd8d0c0) {
    const geometry = new THREE.SphereGeometry(0.09, 6, 6);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const puff = new THREE.Mesh(geometry, material);
    puff.position.set(point.x, point.y, point.z);
    scene.add(puff);
    live.push({ object: puff, age: 0, ttl: 0.18, fade: true, grow: 6 });
  }

  function addDamageNumber(point, amount, head) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${head ? 44 : 36}px Trebuchet MS, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = head ? '#ff5252' : '#ffd35c';
    ctx.strokeText(String(amount), 64, 32);
    ctx.fillText(String(amount), 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    }));
    sprite.scale.set(0.9, 0.45, 1);
    sprite.position.set(
      point.x + (Math.random() - 0.5) * 0.3,
      point.y + 0.25,
      point.z + (Math.random() - 0.5) * 0.3
    );
    scene.add(sprite);
    live.push({ object: sprite, age: 0, ttl: 0.7, fade: true, rise: 1.1 });
  }

  function update(dt) {
    if (flashLight.intensity > 0.05) {
      flashLight.intensity *= Math.max(0, 1 - dt * 26);
    } else {
      flashLight.intensity = 0;
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const fx = live[i];
      fx.age += dt;
      const lifeLeft = 1 - fx.age / fx.ttl;
      if (fx.fade && fx.object.material) {
        fx.object.material.opacity = Math.max(0, lifeLeft * 0.9);
      }
      if (fx.grow) {
        const scale = 1 + fx.age * fx.grow;
        fx.object.scale.set(scale, scale, scale);
      }
      if (fx.rise) {
        fx.object.position.y += fx.rise * dt;
      }
      if (fx.age >= fx.ttl) {
        scene.remove(fx.object);
        if (fx.object.geometry) fx.object.geometry.dispose();
        if (fx.object.material) fx.object.material.dispose();
        live.splice(i, 1);
      }
    }
  }

  return { addTracer, addImpact, addDamageNumber, addMuzzleFlash, update };
}
