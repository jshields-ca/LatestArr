import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListRow } from "@/components/list-row";
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
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { SubsectionHeading } from "@/components/ui/subsection-heading";
import { toast } from "@/components/ui/use-toast";
import {
  ApiError,
  createSmtpProfile,
  deleteSmtpProfile,
  listSmtpProfiles,
  sendTestEmail,
  testSmtpProfile,
  updateSmtpProfile,
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

// Mirrors PORT_GUIDE below: port 465 is implicit TLS (the `secure` flag),
// port 587 is conventionally STARTTLS (a plain connection that upgrades to
// TLS after the handshake — still encrypted, just not "implicit"), and
// anything else (25/2525, or a non-standard port) has no such convention to
// lean on, so it's labeled plainly rather than guessed at. This used to
// collapse every non-465 profile to "No TLS", which misrepresented the very
// common port-587-STARTTLS setup (e.g. Dreamhost) as unencrypted.
function connectionSecurityLabel(
  port: number,
  secure: boolean,
): { label: string; variant: "success" | "neutral" } {
  if (secure) return { label: "Implicit TLS", variant: "success" };
  if (port === 587) return { label: "STARTTLS", variant: "success" };
  return { label: "No TLS", variant: "neutral" };
}

// A compact, always-visible reference for the three port conventions, shown
// next to the Port field so users can pick a port without first learning
// what a TLS handshake is. One short line per port instead of a paragraph.
const PORT_GUIDE: Array<{ port: string; mode: string }> = [
  { port: "587", mode: "STARTTLS — starts unencrypted, then upgrades to TLS" },
  { port: "465", mode: "Implicit TLS — encrypted from the start" },
  { port: "25 / 2525", mode: "Usually unencrypted or relay-only" },
];

function PortGuide({ id }: { id: string }) {
  return (
    <dl id={id} className="flex flex-col gap-1 text-xs text-muted-foreground">
      {PORT_GUIDE.map(({ port, mode }) => (
        <div key={port} className="flex gap-1.5">
          <dt className="shrink-0 font-medium text-foreground">{port}</dt>
          <dd>{mode}</dd>
        </div>
      ))}
    </dl>
  );
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
      toast({ variant: "success", title: "SMTP profile added", description: smtpProfile.name });
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
          <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <SubsectionHeading>Port &amp; encryption</SubsectionHeading>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                required
                value={port}
                onChange={(e) => handlePortChange(e.target.value)}
                disabled={submitting}
                aria-describedby="smtp-port-guide"
              />
            </div>
            <PortGuide id="smtp-port-guide" />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <Label htmlFor="smtp-secure">Use implicit TLS (port 465)</Label>
                <p id="smtp-secure-hint" className="text-xs text-muted-foreground">
                  Set for you based on the port above. Only change it if your provider says
                  otherwise.
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
                aria-describedby="smtp-secure-hint"
              />
            </div>
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

function EditSmtpProfileDialog({
  profile,
  onSaved,
}: {
  profile: SmtpProfile;
  onSaved: (profile: SmtpProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [host, setHost] = useState(profile.host);
  const [port, setPort] = useState(String(profile.port));
  const [secure, setSecure] = useState(profile.secure);
  const [secureTouched, setSecureTouched] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [defaultFromName, setDefaultFromName] = useState(profile.defaultFromName);
  const [defaultFromEmail, setDefaultFromEmail] = useState(profile.defaultFromEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openWithCurrentValues(next: boolean) {
    setOpen(next);
    if (next) {
      setName(profile.name);
      setHost(profile.host);
      setPort(String(profile.port));
      setSecure(profile.secure);
      setSecureTouched(false);
      setUsername("");
      setPassword("");
      setDefaultFromName(profile.defaultFromName);
      setDefaultFromEmail(profile.defaultFromEmail);
      setError(null);
    }
  }

  function handlePortChange(nextPort: string) {
    setPort(nextPort);
    if (!secureTouched) setSecure(impliesSecure(nextPort));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { smtpProfile } = await updateSmtpProfile(profile.id, {
        name,
        host,
        port: Number(port),
        secure,
        username: username || undefined,
        password: password || undefined,
        defaultFromName,
        defaultFromEmail,
      });
      onSaved(smtpProfile);
      setOpen(false);
      toast({ variant: "success", title: "SMTP profile updated" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openWithCurrentValues}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${profile.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit SMTP profile</DialogTitle>
          <DialogDescription>Used to send newsletters and test emails.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-smtp-name">Name</Label>
            <Input
              id="edit-smtp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-smtp-host">Host</Label>
            <Input
              id="edit-smtp-host"
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <SubsectionHeading>Port &amp; encryption</SubsectionHeading>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-smtp-port">Port</Label>
              <Input
                id="edit-smtp-port"
                type="number"
                required
                value={port}
                onChange={(e) => handlePortChange(e.target.value)}
                disabled={submitting}
                aria-describedby="edit-smtp-port-guide"
              />
            </div>
            <PortGuide id="edit-smtp-port-guide" />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <Label htmlFor="edit-smtp-secure">Use implicit TLS (port 465)</Label>
                <p id="edit-smtp-secure-hint" className="text-xs text-muted-foreground">
                  Set for you based on the port above. Only change it if your provider says
                  otherwise.
                </p>
              </div>
              <Switch
                id="edit-smtp-secure"
                checked={secure}
                onCheckedChange={(next) => {
                  setSecure(next);
                  setSecureTouched(true);
                }}
                disabled={submitting}
                aria-describedby="edit-smtp-secure-hint"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-smtp-username">
                Username {profile.hasAuth ? "(leave blank to keep current)" : "(optional)"}
              </Label>
              <Input
                id="edit-smtp-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-smtp-password">
                Password {profile.hasAuth ? "(leave blank to keep current)" : "(optional)"}
              </Label>
              <Input
                id="edit-smtp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-smtp-from-name">From name</Label>
              <Input
                id="edit-smtp-from-name"
                required
                value={defaultFromName}
                onChange={(e) => setDefaultFromName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-smtp-from-email">From email</Label>
              <Input
                id="edit-smtp-from-email"
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
              Save changes
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
      const message = res.ok ? "Test email sent." : (res.message ?? "Failed to send.");
      setResult(message);
      toast({
        variant: res.ok ? "success" : "destructive",
        title: res.ok ? "Test email sent" : "Failed to send test email",
        description: res.ok ? `Sent to ${to}.` : message,
      });
      if (res.ok) setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to send.";
      setResult(message);
      toast({ variant: "destructive", title: "Failed to send test email", description: message });
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
  onChanged,
  onDeleted,
}: {
  profile: SmtpProfile;
  onChanged: (profile: SmtpProfile) => void;
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
      const message = result.ok ? "Connection succeeded." : (result.message ?? "Connection failed.");
      setTestResult(message);
      toast({
        variant: result.ok ? "success" : "destructive",
        title: result.ok ? "Connection succeeded" : "Connection failed",
        description: result.ok ? undefined : message,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setTestResult(message);
      toast({ variant: "destructive", title: "Connection failed", description: message });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSmtpProfile(profile.id);
      onDeleted(profile.id);
      toast({ variant: "success", title: "SMTP profile deleted", description: profile.name });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete.";
      setDeleting(false);
      setConfirmingDelete(false);
      setTestResult(message);
      toast({ variant: "destructive", title: "Failed to delete SMTP profile", description: message });
    }
  }

  const connectionSecurity = connectionSecurityLabel(profile.port, profile.secure);

  return (
    <ListRow
      primary={
        <>
          <p className="truncate font-medium">{profile.name}</p>
          <Badge variant={connectionSecurity.variant}>{connectionSecurity.label}</Badge>
          <Badge variant={profile.hasAuth ? "success" : "neutral"}>
            {profile.hasAuth ? "Authenticated" : "No auth"}
          </Badge>
        </>
      }
      secondary={
        <>
          <p className="truncate text-sm text-muted-foreground">
            {profile.host}:{profile.port} &middot; {profile.defaultFromName} &lt;{profile.defaultFromEmail}&gt;
          </p>
          {testResult ? <p className="text-sm text-muted-foreground">{testResult}</p> : null}
        </>
      }
      actions={
        confirmingDelete ? (
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
            <EditSmtpProfileDialog profile={profile} onSaved={onChanged} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${profile.name}`}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 />
            </Button>
          </>
        )
      }
    >
      {!confirmingDelete ? (
        <div className="border-t border-border pt-3">
          <SendTestEmailControl profileId={profile.id} />
        </div>
      ) : null}
    </ListRow>
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
      <PageHeader
        title="SMTP Profiles"
        description="Configure outgoing mail servers used to send newsletters."
        actions={
          profiles ? (
            <AddSmtpProfileDialog onCreated={(profile) => setProfiles((prev) => [...(prev ?? []), profile])} />
          ) : null
        }
      />

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
              onChanged={(updated) =>
                setProfiles((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)))
              }
              onDeleted={(id) => setProfiles((prev) => (prev ?? []).filter((p) => p.id !== id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
