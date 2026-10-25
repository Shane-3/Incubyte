export interface DemoAccount {
  email: string;
  password: string;
}

/**
 * The demo admin, when the build is given one (VITE_DEMO_ADMIN_*). Anything set here is bundled into public
 * JavaScript, so it is opt-in and meant only for a demo database.
 */
export function demoAdmin(): DemoAccount | null {
  const email = import.meta.env.VITE_DEMO_ADMIN_EMAIL?.trim();
  const password = import.meta.env.VITE_DEMO_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}
