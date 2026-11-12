import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
// The three typefaces, bundled so the app never fetches them from another
// site: no request to a font host on each visit, and they work on a server
// with no internet access. Newsreader's opsz file carries its optical-size
// axis, which the wordmark and page titles pin to the display cut (see
// --font-brand in index.css).
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
