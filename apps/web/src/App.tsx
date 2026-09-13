import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardPage } from "@/pages/dashboard-page";
import { LoginPage } from "@/pages/login-page";
import { NewslettersPage } from "@/pages/newsletters-page";
import { RecipientsPage } from "@/pages/recipients-page";
import { SetupPage } from "@/pages/setup-page";
import { SmtpProfilesPage } from "@/pages/smtp-profiles-page";
import { SourcesPage } from "@/pages/sources-page";
import { TemplatesPage } from "@/pages/templates-page";

// GrapesJS is large (~700kB gzipped) — code-split so it's only downloaded
// by users who actually open the builder, not on every page load.
const TemplateEditorPage = lazy(() =>
  import("@/pages/template-editor-page").then((m) => ({ default: m.TemplateEditorPage })),
);

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
                <Route path="/newsletters" element={<NewslettersPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route
                  path="/templates/:id/edit"
                  element={
                    <Suspense fallback={null}>
                      <TemplateEditorPage />
                    </Suspense>
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
