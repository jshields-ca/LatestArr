import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";

export function DashboardPage() {
  const [enabled, setEnabled] = useState(true);
  const [sendTestCopy, setSendTestCopy] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of newsletters, sources, and recent sends lands here in a later pull request.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Example: newsletter schedule</CardTitle>
          <CardDescription>
            A preview of the settings-row pattern the admin screens (Task #20) will use — a
            disabled control and the settings it gates read as one related unit.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            label="Enabled"
            description="Send this newsletter on its configured schedule."
            htmlFor="example-enabled"
            control={<Switch id="example-enabled" checked={enabled} onCheckedChange={setEnabled} />}
          />
          <SettingRow
            label="Send a copy to myself"
            description="Only available while the newsletter is enabled."
            htmlFor="example-test-copy"
            disabled={!enabled}
            control={
              <Switch
                id="example-test-copy"
                checked={sendTestCopy}
                onCheckedChange={setSendTestCopy}
                disabled={!enabled}
              />
            }
          />
        </CardContent>
      </Card>

      <Separator className="max-w-xl" />
    </div>
  );
}
