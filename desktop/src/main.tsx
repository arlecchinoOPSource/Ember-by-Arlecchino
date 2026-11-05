import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@arlecchino/suite-ui/index.css';
// Ember's reading faces, bundled locally (SIL OFL 1.1), as in Terminal.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600-italic.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import { applyPreferences, readPreferences } from './preferences';
import { App } from './App';
import './styles.css';

// Before the first render, so Ember never appears in the wrong theme or motion level.
applyPreferences(readPreferences());

// Browser preview build only: synthetic in-memory data instead of native storage.
if (import.meta.env.MODE === 'preview') (await import('./preview/sampleNative')).install();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
