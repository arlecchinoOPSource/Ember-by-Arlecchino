import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundManager } from '../src/soundManager.ts';

const urls = { startup: 'local-startup', close: 'local-close', interface: 'local-interface', completion: 'local-completion', error: 'local-error' };
const settings = { muted: false, volume: 70, startupSound: false, interfaceSound: false, sound: false };

function harness(reject = false) {
  const voices = [];
  let now = 0;
  const manager = new SoundManager(urls, url => {
    const voice = { url, volume: 0, currentTime: 1, paused: false, plays: 0, onended: null,
      pause() { this.paused = true; },
      play() { this.plays++; return reject ? Promise.reject(new Error('Device unavailable')) : Promise.resolve(); },
    };
    voices.push(voice);
    return voice;
  }, () => now);
  return { manager, voices, advance: ms => { now += ms; } };
}

test('all cues are off by default; enabling one does not enable the others', () => {
  const { manager, voices } = harness();
  manager.configure(settings);
  for (const cue of Object.keys(urls)) assert.equal(manager.play(cue), false);
  manager.configure({ ...settings, sound: true });
  assert.equal(manager.play('interface'), false);
  assert.equal(manager.play('completion'), true);
  assert.deepEqual(voices.map(v => v.url), ['local-completion']);
});

test('rapid cues never overlap, repeated clicks are throttled, and mute stops playback', () => {
  const { manager, voices, advance } = harness();
  manager.configure({ ...settings, interfaceSound: true, sound: true });
  assert.equal(manager.play('interface'), true);
  assert.equal(manager.play('interface'), false);
  advance(90);
  assert.equal(manager.play('completion'), true);
  assert.equal(voices[0].paused, true);
  assert.equal(voices[0].currentTime, 0);
  manager.configure({ ...settings, interfaceSound: true, sound: true, muted: true });
  assert.equal(voices[1].paused, true);
  assert.equal(manager.play('completion'), false);
  assert.equal(manager.play('startup', true), false);
});

test('volume follows settings and rejected playback is harmless', async () => {
  const { manager, voices } = harness(true);
  manager.configure({ ...settings, startupSound: true, volume: 35 });
  assert.equal(manager.play('startup'), true);
  assert.equal(voices[0].volume, .35);
  assert.equal(voices[0].playbackRate, 1.25);
  await Promise.resolve();
  assert.equal(voices[0].paused, true);
  manager.configure({ ...settings, interfaceSound: true, volume: 0 });
  assert.equal(manager.play('error'), false);
});

test('the close cue follows the startup switch and stops other playback', () => {
  const { manager, voices } = harness();
  manager.configure({ ...settings, startupSound: true, interfaceSound: true });
  assert.equal(manager.play('interface'), true);
  assert.equal(manager.play('close'), true);
  assert.equal(voices[0].paused, true);
  assert.equal(voices[1].url, 'local-close');
  manager.configure({ ...settings, startupSound: false });
  assert.equal(voices[1].paused, true);
  assert.equal(manager.play('close'), false);
});
