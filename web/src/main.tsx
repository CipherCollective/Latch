import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { PRIVATE_ROOT_ERROR_OPTIONS } from './app/react-error-options';
import { MoatProvider } from './services/moat-provider';
import './styles.css';

createRoot(document.getElementById('root')!, PRIVATE_ROOT_ERROR_OPTIONS).render(
  <StrictMode>
    <AppErrorBoundary>
      <MoatProvider>
        <App />
      </MoatProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
