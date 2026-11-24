import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useHasRole } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { usePageTitle } from "@/lib/page-title";
import { ROLE_LABELS, type Role } from "@/lib/roles";

/**
 * Shows the page only to someone with at least `minRole`; anyone else (say,
 * from an old bookmark) gets a short explanation instead. The server
 * refuses the page's requests either way.
 */
export function RequireRole({ minRole, children }: { minRole: Role; children: ReactNode }) {
  if (useHasRole(minRole)) return <>{children}</>;
  return <NoAccess minRole={minRole} />;
}

function NoAccess({ minRole }: { minRole: Role }) {
  usePageTitle("No access");
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          {/* The page's own heading, so it's an h1 (CardTitle is an h2). */}
          <h1 className="text-lg font-semibold leading-none tracking-tight">No access</h1>
          <CardDescription>
            This page needs the {ROLE_LABELS[minRole]} role. Ask an admin if you need it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
