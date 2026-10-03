import { useEffect } from "react";

// /signup est encore une page Astro (plan 15) : react-router ne la connaît pas, donc chargement complet
// (a la place de <Navigate>, qui afficherait « Page introuvable »).
export default function OnboardingPage() {
  useEffect(() => window.location.replace("/signup"), []);
  return null;
}
