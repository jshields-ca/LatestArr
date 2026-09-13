import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ApiError, getAuthProviders } from "@/lib/api";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [oidcAvailable, setOidcAvailable] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingProviders, setCheckingProviders] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuthProviders()
      .then((providers) => {
        setOidcAvailable(providers.oidc);
        setNeedsSetup(providers.needsSetup);
      })
      .catch(() => {
        // If the API is unreachable, the login form still renders — the
        // submit attempt below will surface the real error.
      })
      .finally(() => setCheckingProviders(false));
  }, []);

  if (status === "authenticated") {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/";
    return <Navigate to={redirectTo} replace />;
  }

  if (!checkingProviders && needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/";
      navigate(redirectTo, { replace: true });
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
          <CardTitle className="sr-only">Sign in</CardTitle>
          <CardDescription>Sign in to manage your newsletters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          {oidcAvailable ? (
            <>
              <div className="my-4 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs uppercase text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
              <Button variant="outline" className="w-full" asChild>
                <a href="/api/auth/oidc/login">Continue with SSO</a>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
