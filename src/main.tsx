import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router';
import { BASE_PAGES } from '@app';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NavProvider } from './nav/NavProvider';
import { GetStarted } from './sim/GetStarted';
import { SimulatorShell } from './sim/SimulatorShell';
import './kit/tokens.css';
import './theme/theme.css';
// The tool's brand colors (herocanvas.config.ts, scripts/vite/brand.ts).
import 'virtual:hc-brand.css';

// A part loaded on demand (the comments, a panel) that's gone: a new version was deployed since this tab opened, and its
// files have other names. Loading the page again gets the new version — once, so a part that's really missing still
// shows its error.
window.addEventListener('vite:preloadError', (e) => {
  if (sessionStorage.getItem('hc.reloaded')) return;
  sessionStorage.setItem('hc.reloaded', '1');
  e.preventDefault();
  window.location.reload();
});
window.setTimeout(() => sessionStorage.removeItem('hc.reloaded'), 10_000);

// HashRouter: deep links work on any static host without rewrite rules.
const designer = (
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route
          path="*"
          element={
            <ErrorBoundary
              label="HeroCanvas"
              fill
              actions={
                <button onClick={() => window.location.assign(window.location.pathname + '#/')} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid #d9a3a3', background: '#fff', color: '#7a1d1d', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
                  Back to the start
                </button>
              }
            >
              <NavProvider>
                <SimulatorShell />
              </NavProvider>
            </ErrorBoundary>
          }
        />
      </Routes>
    </HashRouter>
  </StrictMode>
);

// No app connected yet (it declares no pages): how to begin, instead of a simulator with nothing to show.
const noApp = Object.keys(BASE_PAGES).length === 0;

createRoot(document.getElementById('root')!).render(
  noApp ? (
    <StrictMode>
      <GetStarted />
    </StrictMode>
  ) : (
    designer
  ),
);
