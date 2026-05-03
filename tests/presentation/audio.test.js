import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

function closeTo(actual, expected) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) < 0.000001, `expected ${actual} to equal ${expected}`);
}

async function loadAudioRuntime(options = {}) {
  const source = await fs.readFile(new URL('../../js/presentation/audio.js', import.meta.url), 'utf8');
  let latestContext = null;

  class FakeParam {
    constructor(events = null) {
      this.events = events;
    }

    setValueAtTime(value, time) {
      if (this.events) this.events.push({ type: 'set', value: Number(value), time: Number(time) });
    }

    linearRampToValueAtTime(value, time) {
      if (this.events) this.events.push({ type: 'linear', value: Number(value), time: Number(time) });
    }

    exponentialRampToValueAtTime(value, time) {
      if (this.events) this.events.push({ type: 'exponential', value: Number(value), time: Number(time) });
    }
  }

  class FakeNode {
    connect() {}
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class FakeAudioContext {
    constructor() {
      latestContext = this;
      this.currentTime = 10;
      this.destination = new FakeNode();
      this.gainEvents = [];
      this.playbackRateEvents = [];
      this.sources = [];
      this.sampleRate = 48000;
      this.state = 'running';
    }

    createBuffer() {
      return {
        sampleRate: this.sampleRate,
        getChannelData() {
          return new Float32Array(1);
        }
      };
    }

    createBufferSource() {
      const source = new FakeNode();
      source.playbackRate = new FakeParam(this.playbackRateEvents);
      this.sources.push(source);
      return source;
    }

    createBiquadFilter() {
      const filter = new FakeNode();
      filter.frequency = new FakeParam();
      filter.Q = new FakeParam();
      return filter;
    }

    createGain() {
      const gain = new FakeNode();
      gain.gain = new FakeParam(this.gainEvents);
      return gain;
    }

    createOscillator() {
      const osc = new FakeNode();
      osc.frequency = new FakeParam();
      osc.detune = new FakeParam();
      return osc;
    }

    decodeAudioData(_buffer, _resolve, _reject) {
      return Promise.resolve({ sampleRate: this.sampleRate });
    }

    resume() {
      return Promise.resolve();
    }
  }

  const window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    localStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };
  if (options.fetch) window.fetch = options.fetch;

  const sandbox = {
    ArrayBuffer,
    Float32Array,
    Math,
    Promise,
    clearTimeout,
    console,
    setTimeout,
    window,
    __MAYHEM_RUNTIME: {
      GameShared: {
        getSelectableWeaponIds() {
          return [];
        }
      }
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInContext(source, vm.createContext(sandbox));
  return {
    audio: sandbox.__MAYHEM_RUNTIME.GameAudio,
    getContext() {
      return latestContext;
    }
  };
}

async function settleSampleLoads() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('movement samples use tuned footstep and jump gains', async () => {
  const { audio, getContext } = await loadAudioRuntime({
    fetch() {
      return Promise.resolve({
        ok: true,
        arrayBuffer() {
          return Promise.resolve(new ArrayBuffer(8));
        }
      });
    }
  });

  audio.unlock();
  await settleSampleLoads();

  const context = getContext();
  context.gainEvents.length = 0;
  audio.play('footstep', { mode: 'walk' });
  closeTo(context.gainEvents[0].value, 0.03375);

  context.gainEvents.length = 0;
  audio.play('footstep', { mode: 'run' });
  closeTo(context.gainEvents[0].value, 0.050625);

  context.gainEvents.length = 0;
  context.playbackRateEvents.length = 0;
  audio.play('jump');
  closeTo(context.gainEvents[0].value, 0.56);
  closeTo(context.playbackRateEvents[0].value, 1);
});

test('movement wind cue loops quietly with the sprint effect intensity', async () => {
  const { audio, getContext } = await loadAudioRuntime({
    fetch() {
      return Promise.resolve({
        ok: true,
        arrayBuffer() {
          return Promise.resolve(new ArrayBuffer(8));
        }
      });
    }
  });

  audio.unlock();
  await settleSampleLoads();

  const context = getContext();
  context.gainEvents.length = 0;
  audio.updateMovementWind({
    active: true,
    intensity: 0.8,
    adsActive: false,
    scopeActive: false,
    sniper: false
  });

  assert.equal(context.sources.at(-1).loop, true);
  assert.equal(context.sources.at(-1).started, true);
  const activeRamp = context.gainEvents.find((event) => event.type === 'linear' && event.value > 0.001);
  closeTo(activeRamp.value, 0.153);

  context.gainEvents.length = 0;
  audio.updateMovementWind({
    active: true,
    intensity: 0.8,
    adsActive: true
  });
  const mutedRamp = context.gainEvents.find((event) => event.type === 'linear');
  closeTo(mutedRamp.value, 0.0001);
});

test('movement fallback noise uses tuned walk, run, and jump levels', async () => {
  const { audio, getContext } = await loadAudioRuntime();

  audio.play('footstep', { mode: 'walk' });
  let peaks = getContext().gainEvents
    .filter((event) => event.type === 'exponential' && event.value > 0.001)
    .map((event) => event.value);
  assert.deepEqual(peaks, [0.003375]);

  getContext().gainEvents.length = 0;
  audio.play('footstep', { mode: 'run' });
  peaks = getContext().gainEvents
    .filter((event) => event.type === 'exponential' && event.value > 0.001)
    .map((event) => event.value);
  assert.deepEqual(peaks, [0.004875]);

  getContext().gainEvents.length = 0;
  audio.play('jump');
  peaks = getContext().gainEvents
    .filter((event) => event.type === 'exponential' && event.value > 0.001)
    .map((event) => event.value);
  assert.deepEqual(peaks, [0.0135, 0.0140625]);

});

test('throwable cues expose typed throw, impact, and explosion sounds', async () => {
  const { audio, getContext } = await loadAudioRuntime();
  const cueIds = audio.getAssetCueIds();
  for (const cueId of [
    'throw_frag',
    'throw_molotov',
    'throw_knife',
    'throw_plasma',
    'knife_impact',
    'plasma_stick',
    'molotov_ignite',
    'explosion_frag',
    'explosion_plasma',
    'explosion_molotov'
  ]) {
    assert.ok(cueIds.includes(cueId), `${cueId} should be exposed as an audio cue`);
  }

  audio.play('throw', { throwable: 'knife' });
  const context = getContext();
  let peaks = context.gainEvents.filter((event) => event.type === 'exponential' && event.value > 0.001);
  assert.ok(peaks.length >= 3, 'knife throw should layer a blade whoosh with a pitch sweep');

  context.gainEvents.length = 0;
  audio.play('knife_impact', { impactType: 'head' });
  peaks = context.gainEvents.filter((event) => event.type === 'exponential' && event.value > 0.001);
  assert.ok(peaks.length >= 3, 'knife impact should include body and metal accents');

  context.gainEvents.length = 0;
  audio.play('explosion', { projectileType: 'plasma' });
  peaks = context.gainEvents.filter((event) => event.type === 'exponential' && event.value > 0.001);
  assert.ok(peaks.some((event) => event.value >= 0.07), 'plasma explosion should have a stronger energy pop than a throw cue');

  context.gainEvents.length = 0;
  audio.play('molotov_ignite');
  peaks = context.gainEvents.filter((event) => event.type === 'exponential' && event.value > 0.001);
  assert.ok(peaks.length >= 6, 'molotov ignite should combine glass break and fire ignition layers');
});
