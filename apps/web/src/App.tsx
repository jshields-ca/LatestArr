import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/pages/dashboard-page";
import { PlaceholderPage } from "@/pages/placeholder-page";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/sources"
          element={
            <PlaceholderPage
              title="Sources"
              description="Connect and manage Tautulli, Plex, and other media source connections."
            />
          }
        />
        <Route
          path="/recipients"
          element={
            <PlaceholderPage
              title="Recipients"
              description="Manage recipients and the groups newsletters send to."
            />
          }
        />
        <Route
          path="/smtp"
          element={
            <PlaceholderPage
              title="SMTP profiles"
              description="Configure outgoing mail servers used to send newsletters."
            />
          }
        />
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
  );
}
