import { Navigate, useLocation } from "react-router-dom";

// /onboarding mène à l'inscription (le paramètre ?edit=true est conservé pour le middleware).
export default function OnboardingPage() {
  return <Navigate to={{ pathname: "/signup", search: useLocation().search }} replace />;
}
