import { QueryClient } from '@tanstack/react-query';

// Convention unique (A-05 de la phase 16, ADR-014) : tout ce qui touche aux courses vit sous le préfixe ['bookings'].
// Écrans qui dérivent de bookings (ledger, dashboard) : invalidés à chaque événement et à chaque resynchronisation.
export const DERIVED_KEYS = [['ledger'], ['dashboard']] as const;

export const BOOKINGS_KEYS = {
  all: ['bookings'] as const,
  lists: ['bookings', 'list'] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
};

function createClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      // Données toujours relues au retour au premier plan et au retour du réseau (R5) : focusManager / onlineManager.
      queries: { staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true },
    },
  });
  // Sondage de secours 60 s, premier plan seulement (R5). setQueryDefaults filtre par préfixe : listes ET détail
  // (['bookings', 'list', …] et ['bookings', 'detail', id]) en héritent.
  client.setQueryDefaults(BOOKINGS_KEYS.all, { refetchInterval: 60_000, refetchIntervalInBackground: false });
  return client;
}

let browserClient: QueryClient | undefined;

// Singleton de module dans le navigateur : chaque îlot Astro est une racine React distincte mais partage les modules.
// Côté serveur, un client neuf par appel : un cache partagé entre requêtes mélangerait les tenants.
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return createClient();
  return (browserClient ??= createClient());
}
