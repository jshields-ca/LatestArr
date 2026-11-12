import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { usePageTitle } from "@/lib/page-title";

export function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          {/* The page's own heading, so it's an h1 (CardTitle is an h2). */}
          <h1 className="text-lg font-semibold leading-none tracking-tight">Page not found</h1>
          <CardDescription>
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
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
