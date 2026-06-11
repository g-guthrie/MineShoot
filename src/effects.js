/**
 * effects.js - Short-lived combat visuals: tracers and impact puffs.
 */
const THREE = globalThis.THREE;

export function createEffects(scene) {
  const live = [];

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

  return { addTracer, addImpact, addDamageNumber, update };
}
