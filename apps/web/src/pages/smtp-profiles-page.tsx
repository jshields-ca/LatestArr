import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ApiError,
  createSmtpProfile,
  deleteSmtpProfile,
  listSmtpProfiles,
  sendTestEmail,
  testSmtpProfile,
  type SmtpProfile,
} from "@/lib/api";

// Port 465 is "implicit TLS" (the socket is wrapped in TLS before any SMTP
// conversation happens); 587 and 25 are STARTTLS (a plain connection that
// upgrades to TLS after the initial handshake). Sending implicit TLS's
// raw TLS handshake to a STARTTLS-only port fails immediately with an
// OpenSSL "wrong version number" error — the port and the toggle have to
// agree. This only offers a starting guess; the toggle stays a manual
// override for providers that don't follow the convention.
function impliesSecure(port: string): boolean {
  return port.trim() === "465";
}

function AddSmtpProfileDialog({ onCreated }: { onCreated: (profile: SmtpProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(impliesSecure("587"));
  const [secureTouched, setSecureTouched] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [defaultFromName, setDefaultFromName] = useState("");
  const [defaultFromEmail, setDefaultFromEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePortChange(nextPort: string) {
    setPort(nextPort);
    if (!secureTouched) setSecure(impliesSecure(nextPort));
  }

  function reset() {
    setName("");
    setHost("");
    setPort("587");
    setSecure(impliesSecure("587"));
    setSecureTouched(false);
    setUsername("");
    setPassword("");
    setDefaultFromName("");
    setDefaultFromEmail("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { smtpProfile } = await createSmtpProfile({
        name,
        host,
        port: Number(port),
        secure,
        username: username || undefined,
        password: password || undefined,
        defaultFromName,
        defaultFromEmail,
      });
      onCreated(smtpProfile);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add SMTP profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an SMTP profile</DialogTitle>
          <DialogDescription>Used to send newsletters and test emails.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtp-name">Name</Label>
            <Input
              id="smtp-name"
              placeholder="Primary"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="smtp-host">Host</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.example.com"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                required
                value={port}
                onChange={(e) => handlePortChange(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <Label htmlFor="smtp-secure">Use implicit TLS (port 465)</Label>
              <p className="text-sm text-muted-foreground">
                Leave this off for ports 587 and 25 — those use STARTTLS, which upgrades the
                connection to TLS automatically. Turning this on for a STARTTLS port causes
                connection failures.
              </p>
            </div>
            <Switch
              id="smtp-secure"
              checked={secure}
              onCheckedChange={(next) => {
                setSecure(next);
                setSecureTouched(true);
              }}
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtp-username">Username (optional)</Label>
              <Input
                id="smtp-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtp-password">Password (optional)</Label>
              <Input
                id="smtp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtp-from-name">From name</Label>
              <Input
                id="smtp-from-name"
                placeholder="LatestArr"
                required
                value={defaultFromName}
                onChange={(e) => setDefaultFromName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtp-from-email">From email</Label>
              <Input
                id="smtp-from-email"
                type="email"
                required
                value={defaultFromEmail}
                onChange={(e) => setDefaultFromEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Add SMTP profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SendTestEmailControl({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await sendTestEmail(profileId, to);
      setResult(res.ok ? "Test email sent." : (res.message ?? "Failed to send."));
      if (res.ok) setOpen(false);
    } catch (err) {
      setResult(err instanceof ApiError ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Send />
        Send test email
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="email"
        placeholder="you@example.com"
        aria-label="Test email recipient"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        disabled={sending}
        className="h-8 w-48"
      />
      <Button size="sm" onClick={() => void handleSend()} disabled={sending || !to}>
        {sending ? <Loader2 className="animate-spin" /> : null}
        Send
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>
        Cancel
      </Button>
      {result ? <span className="text-sm text-muted-foreground">{result}</span> : null}
    </div>
  );
}

function SmtpProfileRow({
  profile,
  onDeleted,
}: {
  profile: SmtpProfile;
  onDeleted: (id: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSmtpProfile(profile.id);
      setTestResult(result.ok ? "Connection succeeded." : (result.message ?? "Connection failed."));
    } catch (err) {
      setTestResult(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSmtpProfile(profile.id);
      onDeleted(profile.id);
    } catch (err) {
      setDeleting(false);
      setConfirmingDelete(false);
      setTestResult(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{profile.name}</p>
              <Badge variant={profile.secure ? "success" : "neutral"}>{profile.secure ? "TLS" : "No TLS"}</Badge>
              <Badge variant="neutral">{profile.hasAuth ? "Authenticated" : "No auth"}</Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {profile.host}:{profile.port} &middot; {profile.defaultFromName} &lt;{profile.defaultFromEmail}&gt;
            </p>
            {testResult ? <p className="text-sm text-muted-foreground">{testResult}</p> : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-sm text-muted-foreground">Delete this profile?</span>
                <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin" /> : null}
                  Confirm
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={testing}>
                  {testing ? <Loader2 className="animate-spin" /> : null}
                  Test connection
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${profile.name}`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        </div>

        {!confirmingDelete ? (
          <div className="border-t border-border pt-3">
            <SendTestEmailControl profileId={profile.id} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SmtpProfilesPage() {
  const [profiles, setProfiles] = useState<SmtpProfile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listSmtpProfiles()
      .then(({ smtpProfiles: loaded }) => setProfiles(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load SMTP profiles."));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SMTP Profiles</h1>
          <p className="text-sm text-muted-foreground">Configure outgoing mail servers used to send newsletters.</p>
        </div>
        {profiles ? (
          <AddSmtpProfileDialog onCreated={(profile) => setProfiles((prev) => [...(prev ?? []), profile])} />
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {profiles === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading SMTP profiles...
        </div>
      ) : null}

      {profiles && profiles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No SMTP profiles yet</CardTitle>
            <CardDescription>Add one to be able to send newsletters.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {profiles && profiles.length > 0 ? (
        <div className="flex flex-col gap-3">
          {profiles.map((profile) => (
            <SmtpProfileRow
              key={profile.id}
              profile={profile}
              onDeleted={(id) => setProfiles((prev) => (prev ?? []).filter((p) => p.id !== id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
