import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useHasRole } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS, type Role } from "@/lib/roles";

/**
 * Shows the page only to someone with at least `minRole`; anyone else (say,
 * from an old bookmark) gets a short explanation instead. The server
 * refuses the page's requests either way.
 */
export function RequireRole({ minRole, children }: { minRole: Role; children: ReactNode }) {
  if (useHasRole(minRole)) return <>{children}</>;
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle>No access</CardTitle>
          <CardDescription>
            This page needs the {ROLE_LABELS[minRole]} role. Ask an admin if you need it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
