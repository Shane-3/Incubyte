/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional demo admin shown on the sign-in page. Set both in a git-ignored .env.local, never in the repo. */
  readonly VITE_DEMO_ADMIN_EMAIL?: string;
  readonly VITE_DEMO_ADMIN_PASSWORD?: string;
}
