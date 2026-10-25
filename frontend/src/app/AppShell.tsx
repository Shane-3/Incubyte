import { AlertTriangle, LayoutList, Menu as MenuIcon, PackageX, Receipt, TrendingDown, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Menu } from '../components/ui/Menu';
import { Wordmark } from '../components/Wordmark';
import { NotificationBell } from '../notifications/NotificationBell';
import { applyTheme, currentTheme, storedTheme } from './theme';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutList;
  match: (pathname: string, params: URLSearchParams) => boolean;
  adminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: 'Inventory',
    items: [
      {
        label: 'All vehicles',
        to: '/',
        icon: LayoutList,
        match: (path, p) => path === '/' && !p.get('stock') && !p.get('view'),
      },
      {
        label: 'Low stock',
        to: '/?stock=low',
        icon: TrendingDown,
        match: (path, p) => path === '/' && p.get('stock') === 'low',
      },
      {
        label: 'Out of stock',
        to: '/?stock=out',
        icon: PackageX,
        match: (path, p) => path === '/' && p.get('stock') === 'out',
      },
      {
        label: 'At risk',
        to: '/?view=at-risk',
        icon: AlertTriangle,
        match: (path, p) => path === '/' && p.get('view') === 'at-risk',
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Purchases', to: '/purchases', icon: Receipt, match: (path) => path === '/purchases', adminOnly: true },
    ],
  },
];

/** Section and view for the breadcrumb, e.g. "Inventory / Low stock". */
export function currentView(pathname: string, params: URLSearchParams): { section: string; label: string } {
  for (const section of NAV) {
    const item = section.items.find((i) => i.match(pathname, params));
    if (item) return { section: section.label, label: item.label };
  }
  return { section: 'Inventory', label: 'All vehicles' };
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const sections = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || user?.role === 'admin'),
  })).filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-1 px-2.5 text-xs font-medium text-muted">{section.label}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = item.match(pathname, params);
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 text-base ${
                      active
                        ? 'bg-surface-hover font-medium text-text'
                        : 'text-muted hover:bg-surface-hover hover:text-text'
                    }`}
                  >
                    <item.icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(currentTheme);
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <span className="text-right max-sm:hidden">
        <span className="block text-sm font-medium leading-4">{user.name}</span>
        <span className="block text-xs text-muted capitalize">{user.role}</span>
      </span>
      <Menu
        label="Account menu"
        trigger={
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full border border-border-strong text-xs font-medium text-text"
          >
            {initials}
          </span>
        }
        items={[
          {
            label: theme === 'dark' ? 'Use light theme' : 'Use dark theme',
            onSelect: () => {
              const next = theme === 'dark' ? 'light' : 'dark';
              applyTheme(next);
              setTheme(next);
            },
          },
          { label: 'Sign out', onSelect: () => void logout() },
        ]}
      />
    </div>
  );
}

/** Fixed sidebar, slim top bar, and a slide-over nav below the lg breakpoint. */
export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const view = currentView(location.pathname, params);

  useEffect(() => {
    const saved = storedTheme();
    if (saved) document.documentElement.dataset.theme = saved;
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="min-h-dvh bg-page lg:pl-56">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border bg-surface px-3 py-4 lg:flex">
        <Link to="/" className="mb-6 px-2.5">
          <Wordmark />
        </Link>
        <Nav />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-overlay"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface px-3 py-4 shadow-float">
            <div className="mb-6 flex items-center justify-between px-2.5">
              <Wordmark />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setNavOpen(false)}
                className="inline-flex size-7 items-center justify-center rounded-control hover:bg-surface-hover"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
              </button>
            </div>
            <Nav onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-page px-4 sm:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
          className="inline-flex size-8 items-center justify-center rounded-control hover:bg-surface-hover lg:hidden"
        >
          <MenuIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
        <p className="text-sm text-muted">
          {view.section} <span aria-hidden="true">/</span> <span className="text-text">{view.label}</span>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
