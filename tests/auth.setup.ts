import { test as setup, expect } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import './e2e-env';

// Connexion par l'API puis dépôt des cookies sb-* tels que @supabase/ssr les produit.
async function login(role: 'owner' | 'driver', browser: import('@playwright/test').Browser) {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`]!;
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`]!;
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, {
    realtime: { transport: ws as any }, // Node 20 sans WebSocket natif
    cookies: {
      getAll: () => jar,
      setAll: (list) => list.forEach(({ name, value }) => {
        const i = jar.findIndex((c) => c.name === name);
        if (i >= 0) jar[i] = { name, value }; else jar.push({ name, value });
      }),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  expect(error, `connexion ${role}`).toBeNull();

  const context = await browser.newContext();
  await context.addCookies(jar.map((c) => ({ ...c, url: 'http://localhost:4329' })));
  const page = await context.newPage();
  const res = await page.goto('http://localhost:4329/app/dashboard');
  expect(res?.status()).toBe(200);
  expect(page.url()).toContain('/app/');
  await context.storageState({ path: `tests/.auth/${role}.json` });
  await context.close();
}

setup('session owner', ({ browser }) => login('owner', browser));
setup('session driver', ({ browser }) => login('driver', browser));
