import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { BellRing, Loader2 } from "lucide-react";

import { useOptionalAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  getNotificationSettings,
  listSmtpProfiles,
  saveNotificationSettings,
  sendTestAlert,
  type AlertDeliveryResult,
  type NotificationSettings,
  type NotificationSettingsInput,
  type SmtpProfile,
  type WebhookFormat,
} from "@/lib/api";

const WEBHOOK_FORMATS: { value: WebhookFormat; label: string; placeholder: string }[] = [
  { value: "discord", label: "Discord", placeholder: "https://discord.com/api/webhooks/..." },
  { value: "slack", label: "Slack", placeholder: "https://hooks.slack.com/services/..." },
  { value: "ntfy", label: "ntfy", placeholder: "https://ntfy.sh/your-topic" },
  { value: "apprise", label: "Apprise", placeholder: "http://apprise:8000/notify/your-key" },
  { value: "json", label: "Generic JSON", placeholder: "https://example.com/hooks/latestarr" },
];

export function NotificationsPage() {
  const auth = useOptionalAuth();
  const [saved, setSaved] = useState<NotificationSettings | null>(null);
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [onFailure, setOnFailure] = useState(true);
  const [onPartialFailure, setOnPartialFailure] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smtpProfileId, setSmtpProfileId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookFormat, setWebhookFormat] = useState<WebhookFormat>("discord");
  // Empty means "keep the saved URL", since the saved one is never sent back.
  const [webhookUrl, setWebhookUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<AlertDeliveryResult[] | null>(null);

  function applySaved(settings: NotificationSettings) {
    setSaved(settings);
    setOnFailure(settings.onFailure);
    setOnPartialFailure(settings.onPartialFailure);
    setEmailEnabled(settings.email.enabled);
    setSmtpProfileId(settings.email.smtpProfileId ?? "");
    setEmailTo(settings.email.to);
    setWebhookEnabled(settings.webhook.enabled);
    setWebhookFormat(settings.webhook.format);
    setWebhookUrl("");
  }

  useEffect(() => {
    Promise.all([getNotificationSettings(), listSmtpProfiles()])
      .then(([{ settings }, { smtpProfiles: profiles }]) => {
        applySaved(settings);
        setSmtpProfiles(profiles);
        if (!settings.email.to && auth?.user?.email) setEmailTo(auth.user.email);
        if (!settings.email.smtpProfileId && profiles.length === 1) setSmtpProfileId(profiles[0]!.id);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load alert settings."));
    // Load once; the signed-in email only seeds an empty field.
  }, []);

  function currentInput(): NotificationSettingsInput {
    return {
      onFailure,
      onPartialFailure,
      email: { enabled: emailEnabled, smtpProfileId: smtpProfileId || null, to: emailTo },
      webhook: { enabled: webhookEnabled, format: webhookFormat, ...(webhookUrl && { url: webhookUrl }) },
    };
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const { settings } = await saveNotificationSettings(currentInput());
      applySaved(settings);
      toast({ variant: "success", title: "Alert settings saved" });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save alert settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setFormError(null);
    setTestResults(null);
    try {
      const { results } = await sendTestAlert(currentInput());
      setTestResults(results);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't send a test alert.");
    } finally {
      setTesting(false);
    }
  }

  const formatInfo = WEBHOOK_FORMATS.find((format) => format.value === webhookFormat)!;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Get an alert when a scheduled newsletter fails to send, instead of finding out when someone asks where this week's email went."
      />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {!saved && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading alert settings...
        </div>
      ) : null}

      {saved ? (
        <form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSave} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>When to alert</CardTitle>
              <CardDescription>
                Only scheduled and catch-up sends alert, since you see Send now results yourself. At most one alert
                per newsletter per hour.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border py-0">
              <SettingRow
                label="A scheduled send fails"
                description="Including a newsletter that can't send at all, e.g. its SMTP profile was deleted."
                htmlFor="alert-on-failure"
                control={<Switch id="alert-on-failure" checked={onFailure} onCheckedChange={setOnFailure} />}
              />
              <SettingRow
                label="A scheduled send only reaches some recipients"
                htmlFor="alert-on-partial"
                control={
                  <Switch id="alert-on-partial" checked={onPartialFailure} onCheckedChange={setOnPartialFailure} />
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
              <CardDescription>
                If the problem is the mail server itself, this email can&apos;t get through either, so consider a
                webhook too.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SettingRow
                label="Email me"
                htmlFor="alert-email-enabled"
                control={<Switch id="alert-email-enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />}
                className="py-0"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="alert-email-smtp">Send using</Label>
                  <Select
                    id="alert-email-smtp"
                    value={smtpProfileId}
                    onChange={(e) => setSmtpProfileId(e.target.value)}
                    disabled={!emailEnabled}
                  >
                    <option value="">Choose an SMTP profile</option>
                    {smtpProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="alert-email-to">Send alerts to</Label>
                  <Input
                    id="alert-email-to"
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    disabled={!emailEnabled}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook</CardTitle>
              <CardDescription>
                Post alerts to Discord, Slack, ntfy, or Apprise (which reaches most other services), or send generic
                JSON to your own endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SettingRow
                label="Send to a webhook"
                htmlFor="alert-webhook-enabled"
                control={
                  <Switch id="alert-webhook-enabled" checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
                }
                className="py-0"
              />
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="alert-webhook-format">Service</Label>
                  <Select
                    id="alert-webhook-format"
                    value={webhookFormat}
                    onChange={(e) => setWebhookFormat(e.target.value as WebhookFormat)}
                    disabled={!webhookEnabled}
                  >
                    {WEBHOOK_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="alert-webhook-url">Webhook URL</Label>
                  <Input
                    id="alert-webhook-url"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    disabled={!webhookEnabled}
                    placeholder={saved.webhook.hasUrl ? "Saved. Enter a new URL to replace it." : formatInfo.placeholder}
                    aria-describedby="alert-webhook-url-hint"
                  />
                  <p id="alert-webhook-url-hint" className="text-xs text-muted-foreground">
                    {saved.webhook.hasUrl
                      ? `Currently posting to ${saved.webhook.urlHost ?? "a saved URL"}. It's stored encrypted and never shown again.`
                      : "Stored encrypted. Treat it like a password: anyone with it can post to your channel."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          {testResults ? (
            <ul className="flex flex-col gap-1 text-sm" aria-label="Test alert results">
              {testResults.map((result) => (
                <li key={result.destination} className={result.ok ? "text-emerald-500" : "text-destructive"}>
                  {result.destination === "email" ? "Email" : "Webhook"}:{" "}
                  {result.ok ? "sent" : `failed (${result.error ?? "unknown error"})`}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleTest()}
              disabled={testing || (!emailEnabled && !webhookEnabled)}
            >
              {testing ? <Loader2 className="animate-spin" /> : <BellRing />}
              Send test alert
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
