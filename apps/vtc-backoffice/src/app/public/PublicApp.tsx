import { BrowserRouter } from "react-router-dom";
import { DialogProvider, ToastHost } from "@/ui";
import { PublicRoutes } from "./routes";

// Aucune donnée de tenant ici : pas de QueryClient ni de temps réel.
export default function PublicApp() {
  return (
    <BrowserRouter>
      <DialogProvider>
        <ToastHost>
          <PublicRoutes />
        </ToastHost>
      </DialogProvider>
    </BrowserRouter>
  );
}
