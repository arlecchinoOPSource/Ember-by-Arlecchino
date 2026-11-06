import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundManager, cueGain, curve, MAX_CLOSE_MS } from '../src/soundManager.ts';

const urls = { startup: 'local-startup', close: 'local-close', interface: 'local-interface', completion: 'local-completion', error: 'local-error' };
const off = { muted: false, volume: 100, interfaceVolume: 100, startupSound: false, closeSound: false, interfaceSound: false, sound: false, errorSound: false };
const all = { ...off, startupSound: true, closeSound: true, interfaceSound: true, sound: true, errorSound: true };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/** A fake AudioContext: records every started source with its buffer and gain. */
function harness({ state = 'running', resumes = true, failLoad = false, duration = 6 } = {}) {
  const started = [];
  const loads = [];
  let contexts = 0;
  const node = () => ({ gain: { value: 1 }, connect() {}, disconnect() {} });
  const context = {
    state, destination: {},
    resume() { if (resumes) this.state = 'running'; return Promise.resolve(); },
    createGain: node,
    createBufferSource() {
      const source = { buffer: null, stopped: false, onended: null, connect(level) { this.level = level; }, disconnect() {},
        start() { started.push(this); }, stop() { this.stopped = true; } };
      return source;
    },
    decodeAudioData: data => Promise.resolve({ url: data.url, duration }),
  };
  const manager = new SoundManager(urls, () => { contexts++; return context; }, url => {
    loads.push(url);
    return failLoad ? Promise.reject(new Error('missing')) : Promise.resolve({ url });
  });
  return { manager, started, loads, context, contexts: () => contexts, urlsStarted: () => started.map(s => s.buffer.url) };
}

test('loudness follows Terminal’s curve and a cue is silent when Sound or its switch is off', () => {
  assert.equal(curve(100), 1);
  assert.equal(curve(50), 0.25);
  assert.equal(curve(140), 1);
  assert.ok(Math.abs(cueGain({ ...all, volume: 70 }, 'interface') - 0.49) < 1e-9);
  assert.equal(cueGain({ ...all, volume: 50, interfaceVolume: 50 }, 'completion'), 0.0625);
  assert.equal(cueGain({ ...all, muted: true }, 'interface'), 0);
  assert.equal(cueGain({ ...all, sound: false }, 'completion'), 0);
  assert.equal(cueGain({ ...all, sound: false }, 'interface'), 1);
});

test('priming decodes the enabled short cues before the first press', async () => {
  const { manager, loads, started } = harness();
  manager.configure({ ...off, interfaceSound: true, closeSound: true });
  manager.prime();
  await flush();
  assert.deepEqual(loads.sort(), ['local-close', 'local-interface']);
  assert.equal(started.length, 0);
});

test('a primed cue starts in the same turn as the press', async () => {
  const { manager, urlsStarted } = harness();
  manager.configure(all);
  manager.prime();
  await flush();
  assert.equal(manager.play('interface'), true);
  // Promise.all on settled promises resolves in microtasks: no timer, no file load.
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(urlsStarted(), ['local-interface']);
});

test('switches are independent and muting stops what is playing', async () => {
  const { manager, started, urlsStarted } = harness();
  manager.configure({ ...off, sound: true });
  assert.equal(manager.play('interface'), false);
  assert.equal(manager.play('completion'), true);
  await flush();
  assert.deepEqual(urlsStarted(), ['local-completion']);
  manager.configure({ ...off, sound: true, muted: true });
  assert.equal(started[0].stopped, true);
  assert.equal(manager.play('completion'), false);
});

test('a repeated cue replaces the voice still playing instead of stacking', async () => {
  const { manager, started } = harness();
  manager.configure(all);
  manager.play('interface'); await flush();
  manager.play('interface'); await flush();
  assert.equal(started.length, 2);
  assert.equal(started[0].stopped, true);
  assert.equal(started[1].stopped, false);
});

test('preview plays a cue whose switch is off, but not while Sound is off', async () => {
  const { manager, urlsStarted } = harness();
  manager.configure(off);
  assert.equal(manager.preview('error'), true);
  await flush();
  assert.deepEqual(urlsStarted(), ['local-error']);
  manager.configure({ ...off, muted: true });
  assert.equal(manager.preview('error'), false);
});

test('startup plays once, and is skipped when the system keeps audio suspended', async () => {
  const ok = harness();
  ok.manager.configure(all);
  assert.equal(await ok.manager.playStartup(), true);
  assert.equal(await ok.manager.playStartup(), false);
  assert.deepEqual(ok.urlsStarted(), ['local-startup']);

  const blocked = harness({ state: 'suspended', resumes: false });
  blocked.manager.configure(all);
  assert.equal(await blocked.manager.playStartup(), false);
  assert.equal(blocked.started.length, 0);

  const native = harness();
  native.manager.configure(all);
  native.manager.startupHandledNatively();
  assert.equal(await native.manager.playStartup(), false);
});

test('close reports how long to linger, capped, and 0 when off or unplayable', async () => {
  const on = harness({ duration: 6 });
  on.manager.configure(all);
  on.manager.play('interface'); await flush();
  assert.equal(await on.manager.playClose(), 6000);
  assert.equal(on.started[0].stopped, true, 'the close sound replaces other cues');

  const long = harness({ duration: 30 });
  long.manager.configure(all);
  assert.equal(await long.manager.playClose(), MAX_CLOSE_MS);

  const disabled = harness();
  disabled.manager.configure({ ...all, closeSound: false });
  assert.equal(await disabled.manager.playClose(), 0);

  const missing = harness({ failLoad: true });
  missing.manager.configure(all);
  assert.equal(await missing.manager.playClose(), 0);
});

test('a failed load never throws and is retried on the next press', async () => {
  const { manager, loads } = harness({ failLoad: true });
  manager.configure(all);
  assert.doesNotThrow(() => manager.play('interface'));
  await flush();
  manager.play('interface');
  await flush();
  assert.equal(loads.filter(url => url === 'local-interface').length, 2);
});

test('no audio device: every call returns quietly', async () => {
  const manager = new SoundManager(urls, () => null, () => Promise.reject(new Error('unused')));
  manager.configure(all);
  manager.prime();
  assert.doesNotThrow(() => manager.play('completion'));
  assert.equal(await manager.playStartup(), false);
  assert.equal(await manager.playClose(), 0);
});
