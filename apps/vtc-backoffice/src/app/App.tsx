import { BrowserRouter } from "react-router-dom";
import { DialogProvider, ToastHost } from "@/ui";
import { SetupGate } from "./auth/SetupGate";
import { QueryClientProvider, getQueryClient } from "./realtime";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <BrowserRouter>
        <DialogProvider>
          <ToastHost>
            <SetupGate>
              <main data-app-shell>
                <AppRoutes />
              </main>
            </SetupGate>
          </ToastHost>
        </DialogProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
