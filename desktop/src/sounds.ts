import { SoundManager } from './soundManager';
import startup from './assets/startup.wav?url';
import completion from './assets/completion.wav?url';
import interfaceCue from './assets/interface.wav?url';
import error from './assets/error.wav?url';

// Vite embeds these local WAV assets in the desktop app. No external audio is loaded.
export const sounds = new SoundManager({ startup, completion, interface: interfaceCue, error });
