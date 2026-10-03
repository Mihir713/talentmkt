import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/shell/AppShell'
import { RouteError } from './routes/route-error'

// Every page is its own chunk; the shell stays mounted so navigation never shifts the layout.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: () => import('./routes/landing') },
      { path: 'markets', lazy: () => import('./routes/markets') },
      { path: 'markets/:id', lazy: () => import('./routes/market') },
      { path: 'cohorts/:slug', lazy: () => import('./routes/cohort') },
      { path: 'onboard', lazy: () => import('./routes/onboard') },
      { path: 'me', lazy: () => import('./routes/me') },
      { path: 'portfolio', lazy: () => import('./routes/portfolio') },
      { path: 'leaderboard', lazy: () => import('./routes/leaderboard') },
      { path: 'admin', lazy: () => import('./routes/admin') },
      { path: 'signin', lazy: () => import('./routes/signin') },
      { path: '*', lazy: () => import('./routes/not-found') },
    ],
  },
])
