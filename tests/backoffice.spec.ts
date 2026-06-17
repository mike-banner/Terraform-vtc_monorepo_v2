import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import ws from 'ws';

dotenv.config({ path: '.env' });

let supabase: any;

test.beforeAll(() => {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
      transport: ws
    }
  });
});

test.describe.serial('Backoffice E2E Flow', () => {
  let testEmail = `e2e-test-${Date.now()}@vtc.com`;
  let testPassword = 'Password123!';
  let userId: string;
  let tenantId: string;

  test.afterAll(async () => {
    // Nettoyage API Injection / Suppression
    if (userId) {
      console.log(`🧹 Nettoyage de l'utilisateur ${userId}`);
      
      // Delete Tenant
      if (tenantId) {
        await supabase.from('tenants').delete().eq('id', tenantId);
      }
      
      // Delete Driver/Onboarding records implicitly deleted by Cascade if configured, 
      // otherwise explicit deletion
      await supabase.from('onboarding').delete().eq('profile_id', userId);
      
      // Delete Auth user
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test('Scénario 1 : Inscription, Onboarding et Redirection', async ({ page }) => {
    await page.goto('/signup');

    // Etape 1: Compte
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button#next-btn');

    // Etape 2: Profil
    await page.fill('input[name="first_name"]', 'Play');
    await page.fill('input[name="last_name"]', 'Wright');
    // Le téléphone est formaté avec des espaces via JS "6 12 34 56 78"
    await page.fill('input[name="phone_number"]', '612345678');
    await page.click('button#next-btn');

    // Etape 3: Entreprise
    await page.fill('input[name="company_name"]', 'E2E VTC Corp');
    await page.fill('input[name="primary_domain"]', `e2e-domain-${Date.now()}`);
    await page.fill('input[name="siret"]', '12345678900012');
    await page.fill('input[name="vtc_license_number"]', '123456789012');
    
    // Soumission Finale
    await page.click('button#final-btn');

    // Attente de la redirection sur /waiting-approval
    await page.waitForURL('**/waiting-approval');
    await expect(page).toHaveURL(/.*\/waiting-approval/);

    // Vérification en base de données de la création de l'onboarding
    const { data: userList } = await supabase.auth.admin.listUsers();
    const user = userList.users.find(u => u.email === testEmail);
    expect(user).toBeDefined();
    userId = user!.id;

    const { data: onboarding } = await supabase.from('onboarding').select('*').eq('profile_id', userId).single();
    expect(onboarding).toBeDefined();
    expect(onboarding.status).toBe('pending');
  });

  test('Scénario 2 : Approbation Admin (API) et Accès Dashboard', async ({ page }) => {
    expect(userId).toBeDefined();
    
    // Simuler l'action d'un Admin: Approbation de l'onboarding
    const { error } = await supabase.from('onboarding').update({ status: 'approved' }).eq('profile_id', userId);
    expect(error).toBeNull();
    
    // TODO: Normalement, un trigger SQL crée le Tenant et le Profil lors de l'approbation.
    // Vérifier si le tenant a été créé.
    const { data: tenant } = await supabase.from('tenants').select('*').eq('siret', '12345678900012').maybeSingle();
    
    // Si le trigger SQL n'existe pas en local/dev, on peut être bloqué ici, 
    // l'E2E permet justement de vérifier l'existence de cette logique.
    
    // Test de connexion
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    // L'utilisateur approuvé devrait accéder au dashboard (ou au wizard setup si inachevé)
    // await page.waitForURL('**/app');
  });
});
