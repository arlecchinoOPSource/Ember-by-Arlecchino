import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@arlecchino/suite-ui/index.css';
import { APP_DEFAULT_THEMES, applyMotion, applyTheme, effectiveMotion, prefersReducedMotion } from '@arlecchino/suite-ui';
import { App } from './App';
import './styles.css';

// Before the first render, so Ember never appears in the wrong theme or motion level.
// Theme and motion settings arrive with issue #4; until then Ember uses its defaults.
applyTheme(APP_DEFAULT_THEMES.ember);
applyMotion(effectiveMotion('full', prefersReducedMotion()));

// Browser preview build only: synthetic in-memory data instead of native storage.
if (import.meta.env.MODE === 'preview') (await import('./preview/sampleNative')).install();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
