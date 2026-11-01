import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createHashRouter, useParams } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import './styles/polish.css';
import './lib/prefs';
import { bootAuth } from './lib/supabase';
import { AuthGate } from './shell/AuthGate';
import { Shell } from './shell/Shell';

// Every screen is code-split; all of them are fetched in the background once the first one is up,
// so later page switches are instant.
const loaders: (() => Promise<unknown>)[] = [];
const page = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) => {
  loaders.push(load);
  return lazy(async () => ({ default: (await load())[name] as React.ComponentType }));
};

const Dashboard = page(() => import('./features/dashboard/Dashboard'), 'Dashboard');
const Leads = page(() => import('./features/leads/Leads'), 'Leads');
const Contacts = page(() => import('./features/contacts/Contacts'), 'Contacts');
const AccountPage = page(() => import('./features/contacts/AccountPage'), 'AccountPage');
const ContactPage = page(() => import('./features/contacts/ContactPage'), 'ContactPage');
const Deals = page(() => import('./features/deals/Deals'), 'Deals');
const Invoices = page(() => import('./features/invoices/Invoices'), 'Invoices');
const InvoicePrint = page(() => import('./features/invoices/InvoicePrint'), 'InvoicePrint');
const Products = page(() => import('./features/products/Products'), 'Products');
const Inbox = page(() => import('./features/inbox/Inbox'), 'Inbox');
const Reports = page(() => import('./features/reports/Reports'), 'Reports');
const Automations = page(() => import('./features/automations/Automations'), 'Automations');
const Builder = page(() => import('./features/automations/Builder'), 'Builder');
const Tasks = page(() => import('./features/tasks/Tasks'), 'Tasks');
const Settings = page(() => import('./features/settings/Settings'), 'Settings');
const Schedule = page(() => import('./features/schedule/Schedule'), 'Schedule');
const Projects = page(() => import('./features/projects/Projects'), 'Projects');
const Login = page(() => import('./features/auth/Login'), 'Login');
const SetPassword = page(() => import('./features/auth/Login'), 'SetPassword');

/** Redirects an old route, keeping the record id. */
function Redirect({ to }: { to: string }) {
  const { id } = useParams();
  return <Navigate to={id ? `${to}/${id}` : to} replace />;
}

// Hash routing keeps deep links working on static hosting (GitHub Pages today).
// Created after bootAuth() so email-link tokens in the hash are read before the router sees them.
const createRouter = () => createHashRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/set-password',
    element: (
      <Suspense fallback={null}>
        <SetPassword />
      </Suspense>
    ),
  },
  {
    path: '/finance/:id/print',
    element: (
      <AuthGate>
        <Suspense fallback={null}>
          <InvoicePrint />
        </Suspense>
      </AuthGate>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGate>
        <Shell />
      </AuthGate>
    ),
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <Dashboard /> },
      { path: 'pipeline/:id?', element: <Deals /> },
      { path: 'leads/:id?', element: <Leads /> },
      { path: 'customers', element: <Contacts /> },
      { path: 'customers/:id', element: <AccountPage /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'contacts/:id', element: <ContactPage /> },
      { path: 'schedule', element: <Schedule /> },
      { path: 'finance/:id?', element: <Invoices /> },
      { path: 'growth', element: <Reports /> },
      { path: 'projects/:id?', element: <Projects /> },
      { path: 'products/:id?', element: <Products /> },
      { path: 'inbox/:id?', element: <Inbox /> },
      { path: 'automations', element: <Automations /> },
      { path: 'automations/:id', element: <Builder /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'settings/:tab?', element: <Settings /> },
      // Old addresses keep working.
      { path: 'dashboard', element: <Navigate to="/overview" replace /> },
      { path: 'deals/:id?', element: <Redirect to="/pipeline" /> },
      { path: 'accounts/:id?', element: <Redirect to="/customers" /> },
      { path: 'invoices/:id?', element: <Redirect to="/finance" /> },
      { path: 'reports', element: <Navigate to="/growth" replace /> },
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
]);

void bootAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={createRouter()} />
    </StrictMode>,
  );
});

const preload = () => loaders.forEach((load) => load().catch(() => {}));
if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preload, { timeout: 2500 });
else window.setTimeout(preload, 1500);
