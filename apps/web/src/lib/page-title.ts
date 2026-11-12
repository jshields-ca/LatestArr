import { useEffect } from "react";

const APP_NAME = "LatestArr";

/**
 * Names the browser tab after the page, so tabs, history and screen readers
 * can tell pages apart (#332). Back to the app's name alone when the page
 * goes away.
 */
export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
