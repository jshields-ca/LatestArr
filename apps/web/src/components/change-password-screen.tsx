import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, updateCurrentUser } from "@/lib/api";

const MIN_PASSWORD_LENGTH = 12;

// Shown instead of the app after signing in with a temporary password an
// admin set (a new account, or a reset), until a new one is chosen.
export function ChangePasswordScreen() {
  const { user, refresh, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await updateCurrentUser({ currentPassword: current, newPassword: next });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change your password.");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo iconClassName="size-8" textClassName="text-xl" />
          <CardTitle className="mt-2 text-lg">Choose a new password</CardTitle>
          <CardDescription>
            {user?.displayName ? `Welcome, ${user.displayName}. ` : ""}You signed in with a temporary password.
            Choose your own to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="change-current">Temporary password</Label>
              <Input
                id="change-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="change-new">New password</Label>
              <Input
                id="change-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                aria-describedby="change-new-hint"
                required
              />
              <p id="change-new-hint" className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="change-confirm">Confirm new password</Label>
              <Input
                id="change-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save and continue
            </Button>
            <Button type="button" variant="ghost" onClick={() => void logout()}>
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
