import { BrowserRouter } from "react-router-dom";
import { DialogProvider, ToastHost } from "@/ui";
import { SetupGate } from "./auth/SetupGate";
import { QueryClientProvider, getQueryClient } from "./realtime";
import { AppRoutes } from "./routes";
import { AppShell } from "./shell/AppShell";

export default function App() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <BrowserRouter>
        <DialogProvider>
          <ToastHost>
            <SetupGate>
              <AppShell>
                <AppRoutes />
              </AppShell>
            </SetupGate>
          </ToastHost>
        </DialogProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
