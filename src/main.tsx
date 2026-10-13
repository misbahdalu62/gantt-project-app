import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ProjectProvider } from './state/ProjectContext';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemen #root tidak ditemukan');

createRoot(container).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>
);
