import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardPage } from "@/pages/dashboard-page";
import { LoginPage } from "@/pages/login-page";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { RecipientsPage } from "@/pages/recipients-page";
import { SetupPage } from "@/pages/setup-page";
import { SmtpProfilesPage } from "@/pages/smtp-profiles-page";
import { SourcesPage } from "@/pages/sources-page";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/sources" element={<SourcesPage />} />
                <Route path="/recipients" element={<RecipientsPage />} />
                <Route path="/smtp" element={<SmtpProfilesPage />} />
                <Route
                  path="/newsletters"
                  element={
                    <PlaceholderPage
                      title="Newsletters"
                      description="Build, schedule, and send digests from your connected sources."
                    />
                  }
                />
                <Route
                  path="/templates"
                  element={
                    <PlaceholderPage
                      title="Templates"
                      description="Design newsletter layouts with the drag-and-drop builder."
                    />
                  }
                />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
