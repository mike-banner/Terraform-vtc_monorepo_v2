import { lazy, Suspense, type ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import { ROUTE_POLICY } from "@/lib/guards";
import { EmptyState, Skeleton } from "@/ui";
import { RequireRole } from "./auth/RequireRole";
import { AppLink, pathFromPageFile } from "./links";

// Ajouter une page = ajouter src/app/pages/XPage.tsx (export default) ; rien d'autre à modifier.
const files = import.meta.glob<{ default: ComponentType }>("./pages/*Page.tsx");
const pages = Object.entries(files).map(([file, load]) => ({ path: pathFromPageFile(file), Page: lazy(load) }));

export function AppRoutes() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Routes>
        {pages.map(({ path, Page }) => (
          <Route
            key={path}
            path={path}
            element={
              <RequireRole roles={ROUTE_POLICY[path]}>
                <Page />
              </RequireRole>
            }
          />
        ))}
        <Route
          path="*"
          element={
            <EmptyState
              title="Page introuvable"
              action={<AppLink to="/app/dashboard" className="font-bold underline">Retour au tableau de bord</AppLink>}
            />
          }
        />
      </Routes>
    </Suspense>
  );
}
