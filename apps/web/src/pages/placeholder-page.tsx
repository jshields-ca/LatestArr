import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This screen isn&apos;t built yet — it lands in an upcoming pull request.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The backend API for this section is already live; see the project README for the
          equivalent REST endpoints in the meantime.
        </CardContent>
      </Card>
    </div>
  );
}
