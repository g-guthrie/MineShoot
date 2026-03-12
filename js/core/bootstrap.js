const THREE = globalThis.THREE;

const MAX_PIXEL_RATIO = 1.75;

function cappedPixelRatio() {
  return Math.min(MAX_PIXEL_RATIO, Math.max(1, Number(window.devicePixelRatio) || 1));
}

export function createRenderContext() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(cappedPixelRatio());
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const clock = new THREE.Clock();

  return {
    renderer,
    scene,
    clock
  };
}

export function installResizeHandler(renderer) {
  window.addEventListener('resize', function onResize() {
    if (!renderer) return;
    renderer.setPixelRatio(cappedPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
