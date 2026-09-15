import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, bootstrap, getAuthProviders } from "@/lib/api";

const MIN_PASSWORD_LENGTH = 12;

export function SetupPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
  }>({});

  useEffect(() => {
    getAuthProviders()
      .then((providers) => setNeedsSetup(providers.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  if (needsSetup === false) {
    return <Navigate to="/login" replace />;
  }

  function validate(): boolean {
    const errors: typeof fieldErrors = {};
    if (!displayName.trim()) errors.displayName = "Name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await bootstrap(email, password, displayName);
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo iconClassName="size-8" textClassName="text-xl" />
          <CardTitle className="sr-only">Create the admin account</CardTitle>
          <CardDescription>
            Welcome to LatestArr — create the first admin account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (fieldErrors.displayName) setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
                }}
                disabled={submitting}
                aria-invalid={fieldErrors.displayName ? true : undefined}
                aria-describedby={fieldErrors.displayName ? "displayName-error" : undefined}
              />
              {fieldErrors.displayName ? (
                <p id="displayName-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.displayName}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={submitting}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email ? (
                <p id="email-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={submitting}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
              />
              {fieldErrors.password ? (
                <p id="password-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              ) : (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              )}
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
