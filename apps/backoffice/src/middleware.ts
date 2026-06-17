// src/middleware.ts
import { createServerClient } from '@vtc/database';
import { parseCookieHeader } from '@supabase/ssr';
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async ({ cookies, request, redirect, locals }, next) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Initialisation Supabase (SSR)
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(request.headers.get('Cookie') ?? '').map((c) => ({
            name: c.name,
            value: c.value ?? '',
          })),
        setAll: (cookiesToSet: any[]) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookies.set(name, value, options as any),
          ),
      },
    },
  );

  locals.supabase = supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Mapping des types de routes
  const isLoginPage = path === '/login';
  const isSignupPage = path === '/signup';
  const isAuthPage = isLoginPage || isSignupPage;

  const isAppRoute = path.startsWith('/app');
  const isAdminRoute = path.startsWith('/admin');
  const isOnboardingRoute = path.startsWith('/onboarding');
  const isDashboardBase = path === '/dashboard';
  const isSaaSRoute = isAppRoute || isAdminRoute || isOnboardingRoute || isDashboardBase;

  // 1. CAS : Utilisateur NON connecté
  if (!user) {
    if (isSaaSRoute && !isAuthPage) {
      return redirect('/login');
    }
    return next();
  }

  locals.user = user;

  // 2. CAS : Utilisateur connecté -> Récupérer profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  locals.profile = profile || null;

  const isHomePage = path === '/';

  // 3. LOGIQUE DE REDIRECTION (Pour connectés sur Login/Dashboard/Apps)
  if (isSaaSRoute || isAuthPage || isHomePage) {
    // --- PRIORITÉ : ADMIN Plateforme ---
    if (profile?.platform_role) {
      // Toujours vers l'admin dashboard
      if (!isAdminRoute) {
        return redirect('/admin/onboardings');
      }
      return next();
    }

    // --- PRIORITÉ : Flow Onboarding (Pending) ---
    if (profile?.tenant_role === 'pending') {
      // Vérifier s'il a déjà soumis un dossier
      const { data: onboarding } = await supabase
        .from('onboarding')
        .select('status')
        .eq('profile_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // S'il a un dossier pending, il va sur waiting-approval, SAUF s'il demande explicitement /signup?edit=true
      const isWaitingApprovalPage = path === '/waiting-approval';
      const isEditingOnboarding =
        (path === '/onboarding' || path === '/signup') && url.searchParams.get('edit') === 'true';

      if (onboarding && !isWaitingApprovalPage && !isEditingOnboarding) {
        return redirect('/waiting-approval');
      }

      if (!onboarding && !isOnboardingRoute) {
        return redirect('/signup');
      }

      return next();
    }

    // --- PRIORITÉ : Chauffeur Actif (Onboardé) ---
    if (profile?.tenant_id) {
      if (!isAppRoute) {
        return redirect('/app/dashboard');
      }
      return next();
    }

    // --- CAS : Nouveau connecté sans rôle défini (Sécurité) ---
    if (isSaaSRoute && !isOnboardingRoute && !isAdminRoute) {
      return redirect('/signup');
    }
  }

  return next();
});
