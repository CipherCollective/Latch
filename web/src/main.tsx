import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { MoatProvider } from './services/moat-provider';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <MoatProvider>
        <App />
      </MoatProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
