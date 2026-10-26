import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Providers } from './App';
import './index.css';
import { loadAppConfig } from './lib/config';
import { routes } from './routes';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers config={loadAppConfig()}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
