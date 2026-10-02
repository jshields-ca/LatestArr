import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestPasswordReset } from "@/lib/api";
import { RECOVERY_DOCS_URL } from "@/lib/links";

/** Asks for a reset link. The answer is the same whether or not the account exists. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { message } = await requestPasswordReset(email);
      setSent(message);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many requests. Wait a few minutes, then try again."
          : err instanceof ApiError
            ? err.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo iconClassName="size-8" textClassName="text-xl" />
          <CardTitle className="pt-2 text-lg">Reset your password</CardTitle>
          <CardDescription>
            {sent ? "Check your email." : "Enter your account's email, and we'll send you a link to choose a new password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sent ? (
            <div role="status" className="flex gap-3 rounded-md border border-border p-3 text-sm">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p>{sent}</p>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={submitting || !email.trim()}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                Send reset link
              </Button>
            </form>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Signed in with SSO? Your provider handles your password. No email arriving?{" "}
            <a href={RECOVERY_DOCS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Other ways back in
            </a>
            .
          </p>
          <Button variant="ghost" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
