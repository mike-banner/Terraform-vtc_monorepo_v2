import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/backoffice/.env') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'backoffice',
      testMatch: /backoffice\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4321'
      },
    },
    {
      name: 'drivers-front',
      testMatch: /.*\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4321'
      },
    },
  ],
});
