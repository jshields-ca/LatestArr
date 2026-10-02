import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { RequireRole } from "@/components/require-role";
import { Toaster } from "@/components/ui/toaster";
import { DashboardPage } from "@/pages/dashboard-page";
import { DesignEditorPage } from "@/pages/design-editor-page";
import { DesignsPage } from "@/pages/designs-page";
import { ForgotPasswordPage } from "@/pages/forgot-password-page";
import { LoginPage } from "@/pages/login-page";
import { LogsPage } from "@/pages/logs-page";
import { NotificationsPage } from "@/pages/notifications-page";
import { NewslettersPage } from "@/pages/newsletters-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { RecipientsPage } from "@/pages/recipients-page";
import { ResetPasswordPage } from "@/pages/reset-password-page";
import { SetupPage } from "@/pages/setup-page";
import { SmtpProfilesPage } from "@/pages/smtp-profiles-page";
import { SourcesPage } from "@/pages/sources-page";
import { UsersPage } from "@/pages/users-page";

// Old bookmarks to the retired drag-and-drop editor open the same design
// in the design editor.
function TemplateEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/designs/${id}`} replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/sources" element={<SourcesPage />} />
                  <Route path="/recipients" element={<RequireRole minRole="editor"><RecipientsPage /></RequireRole>} />
                  <Route path="/smtp" element={<RequireRole minRole="admin"><SmtpProfilesPage /></RequireRole>} />
                  <Route path="/newsletters" element={<NewslettersPage />} />
                  <Route path="/designs" element={<DesignsPage />} />
                  <Route path="/designs/:id" element={<DesignEditorPage />} />
                  <Route path="/templates" element={<Navigate to="/designs" replace />} />
                  <Route path="/notifications" element={<RequireRole minRole="admin"><NotificationsPage /></RequireRole>} />
                  <Route path="/users" element={<RequireRole minRole="admin"><UsersPage /></RequireRole>} />
                  <Route path="/logs" element={<RequireRole minRole="admin"><LogsPage /></RequireRole>} />
                  <Route path="/templates/:id/edit" element={<TemplateEditRedirect />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}
