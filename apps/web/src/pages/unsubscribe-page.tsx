import { useState } from "react";
import { Loader2 } from "lucide-react";

import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { ApiError, setSubscription } from "@/lib/api";

// What a preview or test email's link carries instead of anyone's code
// (apps/server/src/mailer/unsubscribe.ts NOT_A_RECIPIENT).
const NOT_A_RECIPIENT = "preview";

type State = "asking" | "unsubscribed" | "subscribed";

/**
 * Where an email's Unsubscribe link lands (#383). No sign-in: the code
 * after the # is the person's key, and it never reaches the server's logs,
 * because browsers don't send that part. Opening the page changes nothing,
 * so a mail scanner following links can't unsubscribe anyone; the button
 * does. It says nothing about who the code belongs to.
 */
export function UnsubscribePage() {
  const [token] = useState(() => window.location.hash.replace(/^#/, "").trim());
  const [state, setState] = useState<State>("asking");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(subscribed: boolean) {
    setWorking(true);
    setError(null);
    try {
      await setSubscription(token, subscribed);
      setState(subscribed ? "subscribed" : "unsubscribed");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "This link isn't valid. It may be from an old email, or from an address that's since been removed."
          : err instanceof ApiError && err.status === 429
            ? "Too many tries. Wait a minute, then try again."
            : "Something went wrong. Please try again.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (!token || token === NOT_A_RECIPIENT) {
    return (
      <AuthCard
        title="Unsubscribe"
        description={
          token
            ? "This link is from a preview or a test email, so there's no one to unsubscribe."
            : "This link is missing its code. Use the Unsubscribe link at the bottom of a newsletter."
        }
      >
        {null}
      </AuthCard>
    );
  }

  const copy: Record<State, { title: string; description: string; action: string; subscribe: boolean }> = {
    asking: {
      title: "Unsubscribe",
      description: "Stop getting newsletters from this server? You'll stop getting all of them.",
      action: "Unsubscribe",
      subscribe: false,
    },
    unsubscribed: {
      title: "You've unsubscribed",
      description: "You won't get any more newsletters from this server. Changed your mind?",
      action: "Subscribe again",
      subscribe: true,
    },
    subscribed: {
      title: "You're subscribed again",
      description: "You'll get its newsletters as before.",
      action: "Unsubscribe",
      subscribe: false,
    },
  };
  const { title, description, action, subscribe } = copy[state];

  return (
    <AuthCard title={title} description={description} contentClassName="flex flex-col gap-4">
      {/* Says the outcome to a screen reader after a choice. */}
      <p className="sr-only" aria-live="polite">
        {state === "asking" ? "" : title}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant={subscribe ? "outline" : "default"}
        disabled={working}
        onClick={() => void choose(subscribe)}
      >
        {working ? <Loader2 className="animate-spin" /> : null}
        {action}
      </Button>
    </AuthCard>
  );
}
