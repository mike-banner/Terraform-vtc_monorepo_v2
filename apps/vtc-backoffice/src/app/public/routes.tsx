import { lazy, Suspense, type ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import { EmptyState, Skeleton } from "@/ui";

// Ajouter une page publique = ajouter src/app/public/XPage.tsx (export default). IndexPage = "/".
const files = import.meta.glob<{ default: ComponentType }>("./*Page.tsx");

export function publicPathFromFile(file: string): string {
  const name = (file.split("/").pop() ?? "").replace(/Page\.tsx$/, "");
  return name === "Index" ? "/" : `/${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

const pages = Object.entries(files).map(([file, load]) => ({ path: publicPathFromFile(file), Page: lazy(load) }));

export function PublicRoutes() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton /></div>}>
      <Routes>
        {pages.map(({ path, Page }) => (
          <Route key={path} path={path} element={<Page />} />
        ))}
        <Route
          path="*"
          element={
            <div className="p-8">
              <EmptyState title="Page introuvable" action={<a href="/" className="font-bold underline">Retour à l'accueil</a>} />
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
