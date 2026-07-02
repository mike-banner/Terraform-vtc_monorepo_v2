// src/middleware.ts
import { createServerClient } from '@vtc/database';
import { parseCookieHeader } from '@supabase/ssr';
import { defineMiddleware } from 'astro:middleware';

// D-01 : durée de vie prolongée du cookie de session pour le chauffeur sur une course en cours.
const ACTIVE_COURSE_MAXAGE_SECONDS = 8 * 60 * 60; // 8h

// Décode le payload d'un JWT (segment base64url du milieu), sans vérification de signature.
// Sûr ici car appelé uniquement sur le access_token déjà authentifié par supabase.auth.getUser().
function decodeJwtPayload(accessToken: string): Record<string, any> | null {
  try {
    const [, payload] = accessToken.split('.');
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async ({ cookies, request, redirect, locals }, next) => {
  const url = new URL(request.url);
  const path = url.pathname;
  
  console.log("---- MIDDLEWARE HIT:", path);
  console.log("COOKIE HEADER:", request.headers.get('Cookie'));

  // options par défaut appliquées par setAll — capturées pour pouvoir les répliquer
  // à l'identique lors du re-set explicite du cookie (seul maxAge doit changer).
  let defaultCookieOptions: Record<string, any> = {};

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
          cookiesToSet.forEach(({ name, value, options }) => {
            const safeOptions = { ...options };
            // En local (http), forcer secure à false pour éviter que le navigateur rejette le cookie
            if (url.protocol === 'http:') {
              safeOptions.secure = false;
            }
            defaultCookieOptions = safeOptions as any;
            cookies.set(name, value, safeOptions as any);
          }),
      },
    },
  );

  locals.supabase = supabase;
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  console.log("USER FETCHED:", !!user, "ERROR:", authError?.message);

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
      console.log("REDIRECTING TO /login because !user && isSaaSRoute && !isAuthPage");
      return redirect('/login');
    }
    return next();
  }

  locals.user = user;

  // 2. CAS : Utilisateur connecté -> Résoudre le profil depuis les claims JWT (D-03/D-04)
  // Plus de requête profiles ici : tenant_role/tenant_id/platform_role sont injectés dans
  // l'access_token par le hook Supabase Auth (voir 10-01). getUser() a déjà prouvé
  // l'authenticité du token, on peut donc décoder ses claims sans requête supplémentaire.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const claims = session?.access_token ? decodeJwtPayload(session.access_token) : null;

  let profile: { platform_role: any; tenant_role: any; tenant_id: any } | null = null;

  if (claims && (claims.tenant_role !== undefined || claims.platform_role !== undefined)) {
    profile = {
      platform_role: claims.platform_role ?? null,
      tenant_role: claims.tenant_role ?? null,
      tenant_id: claims.tenant_id ?? null,
    };
  } else {
    // ponytail: fallback pour les sessions émises avant l'activation du hook — une seule
    // requête profiles, pas un second chemin permanent. Disparaît quand ces tokens expirent.
    const { data: legacyProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    profile = legacyProfile || null;
  }

  locals.profile = profile;

  // D-01/D-02 : chauffeur lié à une course en cours (mission_status = 'in_progress')
  // -> session prolongée. Requête scopée sur bookings, jamais sur profiles (pas de
  // régression de latence). Ne s'applique qu'au tenant_role 'driver'.
  let hasActiveCourse = false;
  if (profile?.tenant_role === 'driver' && profile?.tenant_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id)
      .limit(1)
      .maybeSingle();

    if (driver) {
      const { data: activeBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('driver_id', driver.id)
        .eq('mission_status', 'in_progress')
        .limit(1)
        .maybeSingle();

      hasActiveCourse = Boolean(activeBooking);
    }
  }

  // Ré-écrit explicitement le(s) cookie(s) d'auth Supabase une fois hasActiveCourse connu,
  // APRÈS son calcul — jamais dans le closure setAll (qui peut s'exécuter pendant
  // getUser()/getSession(), avant que hasActiveCourse ne soit déterminé).
  const applySessionMaxAge = () => {
    const requestCookies = parseCookieHeader(request.headers.get('Cookie') ?? '');
    requestCookies
      .filter((c) => c.name.startsWith('sb-'))
      .forEach(({ name }) => {
        const value = cookies.get(name)?.value;
        if (value === undefined) return;
        cookies.set(name, value, {
          ...defaultCookieOptions,
          maxAge: hasActiveCourse ? ACTIVE_COURSE_MAXAGE_SECONDS : defaultCookieOptions.maxAge,
        });
      });
  };

  const finish = async (response: Response) => {
    applySessionMaxAge();
    return response;
  };

  const isHomePage = path === '/';

  // 3. LOGIQUE DE REDIRECTION (Pour connectés sur Login/Dashboard/Apps)
  if (isSaaSRoute || isAuthPage || isHomePage) {
    // --- PRIORITÉ : ADMIN Plateforme ---
    // Le backoffice est réservé aux tenants. L'admin reste sur l'accueil uniquement.
    if (profile?.platform_role) {
      if (!isHomePage) return finish(await redirect('/'));
      return finish(await next());
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
        return finish(await redirect('/waiting-approval'));
      }

      if (!onboarding && !isOnboardingRoute) {
        return finish(await redirect('/signup'));
      }

      return finish(await next());
    }

    // --- PRIORITÉ : Chauffeur Actif (Onboardé) ---
    if (profile?.tenant_id) {
      if (!isAppRoute) {
        return finish(await redirect('/app/dashboard'));
      }
      return finish(await next());
    }

    // --- CAS : Nouveau connecté sans rôle défini (Sécurité) ---
    if (isSaaSRoute && !isOnboardingRoute && !isAdminRoute) {
      return finish(await redirect('/signup'));
    }
  }

  return finish(await next());
});
