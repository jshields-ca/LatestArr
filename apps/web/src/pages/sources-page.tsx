import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

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
import { Select } from "@/components/ui/select";
import {
  ApiError,
  createSource,
  deleteSource,
  listSourceKinds,
  listSources,
  testSourceConnection,
  type SourceConnection,
} from "@/lib/api";

interface SourceKindField {
  key: string;
  label: string;
  type?: string;
}

interface SourceKindConfig {
  label: string;
  description: string;
  fields: SourceKindField[];
}

// The SourceAdapter contract takes an opaque Record<string, string> of
// credentials, so field metadata (labels, how many fields, which are
// secrets) isn't discoverable from the server — it's tracked here per kind.
// A kind the server registers but that's missing from this map still works,
// falling back to a single generic "API key" field.
const KIND_CONFIG: Record<string, SourceKindConfig> = {
  tautulli: {
    label: "Tautulli",
    description: "Connect a Tautulli server for Plex activity data.",
    fields: [{ key: "apiKey", label: "Tautulli API key", type: "password" }],
  },
  plex: {
    label: "Plex",
    description: "Connect directly to a Plex Media Server.",
    fields: [{ key: "token", label: "Plex token", type: "password" }],
  },
  booklore: {
    label: "BookLore",
    description: "Connect to a BookLore OPDS catalog.",
    fields: [
      { key: "username", label: "OPDS username" },
      { key: "password", label: "OPDS password", type: "password" },
    ],
  },
  bookorbit: {
    label: "BookOrbit",
    description: "Connect to a BookOrbit OPDS catalog.",
    fields: [
      { key: "username", label: "OPDS username" },
      { key: "password", label: "OPDS password", type: "password" },
    ],
  },
  grimmory: {
    label: "Grimmory",
    description: "Connect to a Grimmory OPDS catalog.",
    fields: [
      { key: "username", label: "OPDS username" },
      { key: "password", label: "OPDS password", type: "password" },
    ],
  },
  audiobookshelf: {
    label: "Audiobookshelf",
    description: "Connect to an Audiobookshelf server.",
    fields: [{ key: "token", label: "Audiobookshelf API token", type: "password" }],
  },
  romm: {
    label: "RomM",
    description: "Connect to a RomM server.",
    fields: [{ key: "token", label: "RomM client API token", type: "password" }],
  },
};

const FALLBACK_CONFIG: SourceKindConfig = {
  label: "Source",
  description: "Connect a media source.",
  fields: [{ key: "apiKey", label: "API key", type: "password" }],
};

// Used before the server's own list of registered kinds has loaded, so the
// dialog is usable immediately rather than waiting on a second request.
const FALLBACK_KINDS = Object.keys(KIND_CONFIG);

function StatusBadge({ status }: { status: SourceConnection["status"] }) {
  if (status === "ok") return <Badge variant="success">Connected</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="neutral">Not yet tested</Badge>;
}

function AddSourceDialog({
  kinds,
  onCreated,
}: {
  kinds: string[];
  onCreated: (source: SourceConnection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [kind, setKind] = useState(kinds[0] ?? "tautulli");
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = KIND_CONFIG[kind] ?? FALLBACK_CONFIG;

  function reset() {
    setName("");
    setBaseUrl("");
    setKind(kinds[0] ?? "tautulli");
    setCredentialValues({});
    setError(null);
  }

  function handleKindChange(nextKind: string) {
    setKind(nextKind);
    setCredentialValues({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { source } = await createSource({
        name,
        kind,
        baseUrl,
        credentials: credentialValues,
      });
      onCreated(source);
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
          Add source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-kind">Source type</Label>
            <Select
              id="source-kind"
              value={kind}
              onChange={(e) => handleKindChange(e.target.value)}
              disabled={submitting}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_CONFIG[k]?.label ?? k}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-name">Name</Label>
            <Input
              id="source-name"
              placeholder="Home Tautulli"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-base-url">Base URL</Label>
            <Input
              id="source-base-url"
              type="url"
              placeholder="http://localhost:8181"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={submitting}
            />
          </div>
          {config.fields.map((field) => (
            <div className="flex flex-col gap-1.5" key={field.key}>
              <Label htmlFor={`source-field-${field.key}`}>{field.label}</Label>
              <Input
                id={`source-field-${field.key}`}
                type={field.type ?? "text"}
                required
                value={credentialValues[field.key] ?? ""}
                onChange={(e) =>
                  setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                disabled={submitting}
              />
            </div>
          ))}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Add source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RowState {
  testing: boolean;
  testResult: string | null;
  confirmingDelete: boolean;
  deleting: boolean;
}

function SourceRow({
  source,
  onDeleted,
  onStatusChange,
}: {
  source: SourceConnection;
  onDeleted: (id: string) => void;
  onStatusChange: (id: string, status: SourceConnection["status"], lastError: string | null) => void;
}) {
  const [state, setState] = useState<RowState>({
    testing: false,
    testResult: null,
    confirmingDelete: false,
    deleting: false,
  });

  async function handleTest() {
    setState((s) => ({ ...s, testing: true, testResult: null }));
    try {
      const result = await testSourceConnection(source.id);
      onStatusChange(source.id, result.ok ? "ok" : "error", result.ok ? null : (result.message ?? "Unknown error"));
      setState((s) => ({ ...s, testing: false, testResult: result.ok ? "Connection succeeded." : (result.message ?? "Connection failed.") }));
    } catch (err) {
      setState((s) => ({
        ...s,
        testing: false,
        testResult: err instanceof ApiError ? err.message : "Something went wrong.",
      }));
    }
  }

  async function handleDelete() {
    setState((s) => ({ ...s, deleting: true }));
    try {
      await deleteSource(source.id);
      onDeleted(source.id);
    } catch (err) {
      setState((s) => ({
        ...s,
        deleting: false,
        confirmingDelete: false,
        testResult: err instanceof ApiError ? err.message : "Failed to delete.",
      }));
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{source.name}</p>
            <Badge variant="neutral">{source.kind}</Badge>
            <StatusBadge status={source.status} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{source.baseUrl}</p>
          {state.testResult ? <p className="text-sm text-muted-foreground">{state.testResult}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {state.confirmingDelete ? (
            <>
              <span className="text-sm text-muted-foreground">Delete this source?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete()}
                disabled={state.deleting}
              >
                {state.deleting ? <Loader2 className="animate-spin" /> : null}
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setState((s) => ({ ...s, confirmingDelete: false }))}
                disabled={state.deleting}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={state.testing}>
                {state.testing ? <Loader2 className="animate-spin" /> : null}
                Test connection
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${source.name}`}
                onClick={() => setState((s) => ({ ...s, confirmingDelete: true }))}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SourcesPage() {
  const [sources, setSources] = useState<SourceConnection[] | null>(null);
  const [kinds, setKinds] = useState<string[]>(FALLBACK_KINDS);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listSources()
      .then(({ sources: loaded }) => setSources(loaded))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load sources."));
    // A failure here just keeps the FALLBACK_KINDS default — it shouldn't
    // block the sources list (the more important half of this page) from
    // loading.
    listSourceKinds()
      .then(({ kinds: loaded }) => {
        if (loaded.length > 0) setKinds(loaded);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="text-sm text-muted-foreground">
            Connect and manage Tautulli, Plex, and other media source connections.
          </p>
        </div>
        {sources ? (
          <AddSourceDialog
            kinds={kinds}
            onCreated={(source) => setSources((prev) => [...(prev ?? []), source])}
          />
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {sources === null && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading sources...
        </div>
      ) : null}

      {sources && sources.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sources yet</CardTitle>
            <CardDescription>Add a source to start pulling in recently-added content.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {sources && sources.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              onDeleted={(id) => setSources((prev) => (prev ?? []).filter((s) => s.id !== id))}
              onStatusChange={(id, status, lastError) =>
                setSources((prev) =>
                  (prev ?? []).map((s) => (s.id === id ? { ...s, status, lastError } : s)),
                )
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
