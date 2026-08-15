import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/fira-sans/800.css';
import '@fontsource/fira-sans/800-italic.css';
import '@fontsource/fira-sans/900.css';
import '@fontsource/fira-sans-condensed/800-italic.css';
import '@fontsource/fira-sans-condensed/900.css';
import '@fontsource/fira-sans-condensed/900-italic.css';

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
