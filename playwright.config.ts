import './tests/e2e-env'; // garde : base locale uniquement
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // base partagée,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  // L'app est lancée par Playwright contre la base locale (env passé au processus,
  // prioritaire sur apps/vtc-backoffice/.env) ; jamais un serveur déjà lancé.
  webServer: {
    command: 'pnpm --filter @vtc/vtc-backoffice dev --port 4329',
    url: 'http://localhost:4329/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL!,
      PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      PUBLIC_DEMO_EMAIL: '',
      PUBLIC_DEMO_PASSWORD: '',
    },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { baseURL: 'http://localhost:4329' } },
    {
      name: 'backoffice-mobile',
      testMatch: /backoffice-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, baseURL: 'http://localhost:4329' },
    },
    {
      name: 'backoffice-desktop',
      testMatch: /backoffice-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, baseURL: 'http://localhost:4329' },
    },
    {
      name: 'backoffice',
      testMatch: /backoffice\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4329'
      },
    },
    {
      name: 'drivers-front',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /(onboarding-approval|superadmin-analytics)\.spec\.ts|backoffice-.*\.spec\.ts|auth\.setup\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4321'
      },
    },
    {
      // Lancer `pnpm dev --filter superadmin` avant, contre la même base que .env.e2e.
      name: 'superadmin',
      testMatch: /(onboarding-approval|superadmin-analytics)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4323'
      },
    },
  ],
});
