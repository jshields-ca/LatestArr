import type { DesignSettings } from "./design";
import type { Role } from "./roles";

export class ApiError extends Error {
  status: number;
  /** The parsed JSON error response, for routes that return more than a
   * message (e.g. a code design's line-by-line issues). */
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Every backend route lives under /api (see apps/server/src/app.ts) so it
  // never collides with an SPA client-side route of the same name (e.g.
  // "/sources" the page vs. "/sources" the endpoint) once both are served
  // from the same origin in production.
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      // Only set Content-Type when actually sending a body — Fastify's
      // JSON parser rejects an empty body if this header is present
      // (e.g. on the bodyless POST /auth/logout).
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  /** Signed in with a temporary password an admin set; a new one must be
   * chosen before using the app. */
  mustChangePassword?: boolean;
}

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasPassword: boolean;
  ssoLinked: boolean;
}

export function listUsers(): Promise<{ users: ManagedUser[] }> {
  return apiFetch<{ users: ManagedUser[] }>("/users");
}

// No password: the person signs in with SSO only.
export function createUser(input: { email: string; displayName: string; password?: string; role: Role }): Promise<{ user: ManagedUser }> {
  return apiFetch<{ user: ManagedUser }>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(
  id: string,
  input: { displayName?: string; isActive?: boolean; password?: string; role?: Role },
): Promise<{ user: ManagedUser }> {
  return apiFetch<{ user: ManagedUser }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(`/users/${id}`, { method: "DELETE" });
}

export interface AuthProviders {
  local: boolean;
  oidc: boolean;
  needsSetup: boolean;
  /** Whether "Forgot password?" can email a reset link. */
  passwordReset?: boolean;
}

export function getAuthProviders(): Promise<AuthProviders> {
  return apiFetch<AuthProviders>("/auth/providers");
}

/** Always answers the same way, whether or not the account exists. */
export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export type ResetLinksUnavailableReason = "no_system_mail" | "no_web_origin" | "origin_mismatch";

export interface SystemMailSettings {
  smtpProfileId: string | null;
  resetLinks: { available: true } | { available: false; reason: ResetLinksUnavailableReason };
  webOrigin: string | null;
}

export function getSystemMail(): Promise<SystemMailSettings> {
  return apiFetch<SystemMailSettings>("/settings/system-mail");
}

export function saveSystemMail(smtpProfileId: string | null): Promise<SystemMailSettings> {
  return apiFetch<SystemMailSettings>("/settings/system-mail", {
    method: "PUT",
    body: JSON.stringify({ smtpProfileId }),
  });
}

export function getVersion(): Promise<{ version: string }> {
  return apiFetch<{ version: string }>("/version");
}

export function getCurrentUser(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/me");
}

export function updateCurrentUser(input: {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function login(email: string, password: string): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function bootstrap(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export interface SourceConnection {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  publicUrl: string | null;
  status: "ok" | "error" | "unconfigured";
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSourceInput {
  name: string;
  kind: string;
  baseUrl: string;
  publicUrl?: string;
  credentials: Record<string, string>;
}

export interface TestConnectionResult {
  ok: boolean;
  message?: string;
}

export function listSources(): Promise<{ sources: SourceConnection[] }> {
  return apiFetch<{ sources: SourceConnection[] }>("/sources");
}

export function listSourceKinds(): Promise<{ kinds: string[] }> {
  return apiFetch<{ kinds: string[] }>("/sources/kinds");
}

export function createSource(input: CreateSourceInput): Promise<{ source: SourceConnection }> {
  return apiFetch<{ source: SourceConnection }>("/sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSource(
  id: string,
  input: { name?: string; baseUrl?: string; publicUrl?: string; credentials?: Record<string, string> },
): Promise<{ source: SourceConnection }> {
  return apiFetch<{ source: SourceConnection }>(`/sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSource(id: string): Promise<void> {
  return apiFetch<void>(`/sources/${id}`, { method: "DELETE" });
}

export function testSourceConnection(id: string): Promise<TestConnectionResult> {
  return apiFetch<TestConnectionResult>(`/sources/${id}/test`, { method: "POST" });
}

export interface SourceUser {
  externalId: string;
  username: string;
  email?: string;
}

// Rejects with a 404 ApiError when the source's kind doesn't support
// listing users at all (see the route's own comment in
// apps/server/src/http/routes/sources.ts) — callers should only show an
// "Import users" action for a source kind known to support this.
export function listSourceUsers(id: string): Promise<{ users: SourceUser[] }> {
  return apiFetch<{ users: SourceUser[] }>(`/sources/${id}/users`);
}

export interface Recipient {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipientGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listRecipients(): Promise<{ recipients: Recipient[] }> {
  return apiFetch<{ recipients: Recipient[] }>("/recipients");
}

export function createRecipient(input: {
  email: string;
  displayName?: string;
}): Promise<{ recipient: Recipient }> {
  return apiFetch<{ recipient: Recipient }>("/recipients", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRecipient(
  id: string,
  input: { email?: string; displayName?: string; isActive?: boolean },
): Promise<{ recipient: Recipient }> {
  return apiFetch<{ recipient: Recipient }>(`/recipients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteRecipient(id: string): Promise<void> {
  return apiFetch<void>(`/recipients/${id}`, { method: "DELETE" });
}

export interface RecipientImportResult {
  created: Recipient[];
  skipped: { email: string; displayName?: string; reason: string }[];
}

export function importRecipients(
  rows: { email: string; displayName?: string }[],
): Promise<RecipientImportResult> {
  return apiFetch<RecipientImportResult>("/recipients/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export function listGroups(): Promise<{ groups: RecipientGroup[] }> {
  return apiFetch<{ groups: RecipientGroup[] }>("/recipient-groups");
}

export function createGroup(input: {
  name: string;
  description?: string;
}): Promise<{ group: RecipientGroup }> {
  return apiFetch<{ group: RecipientGroup }>("/recipient-groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGroup(
  id: string,
  input: { name?: string; description?: string },
): Promise<{ group: RecipientGroup }> {
  return apiFetch<{ group: RecipientGroup }>(`/recipient-groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteGroup(id: string): Promise<void> {
  return apiFetch<void>(`/recipient-groups/${id}`, { method: "DELETE" });
}

export function getGroupMembers(id: string): Promise<{ group: RecipientGroup; members: Recipient[] }> {
  return apiFetch<{ group: RecipientGroup; members: Recipient[] }>(`/recipient-groups/${id}`);
}

export function getRecipientGroups(recipientId: string): Promise<{ groups: RecipientGroup[] }> {
  return apiFetch<{ groups: RecipientGroup[] }>(`/recipients/${recipientId}/groups`);
}

export function addGroupMember(groupId: string, recipientId: string): Promise<void> {
  return apiFetch<void>(`/recipient-groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ recipientId }),
  });
}

export function removeGroupMember(groupId: string, recipientId: string): Promise<void> {
  return apiFetch<void>(`/recipient-groups/${groupId}/members/${recipientId}`, {
    method: "DELETE",
  });
}

export interface SmtpProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  hasAuth: boolean;
  defaultFromName: string;
  defaultFromEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSmtpProfileInput {
  name: string;
  host: string;
  port: number;
  secure?: boolean;
  username?: string;
  password?: string;
  defaultFromName: string;
  defaultFromEmail: string;
}

export interface SendResult {
  ok: boolean;
  message?: string;
  messageId?: string;
}

export function listSmtpProfiles(): Promise<{ smtpProfiles: SmtpProfile[] }> {
  return apiFetch<{ smtpProfiles: SmtpProfile[] }>("/smtp-profiles");
}

export function createSmtpProfile(
  input: CreateSmtpProfileInput,
): Promise<{ smtpProfile: SmtpProfile }> {
  return apiFetch<{ smtpProfile: SmtpProfile }>("/smtp-profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateSmtpProfileInput {
  name?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
}

export function updateSmtpProfile(
  id: string,
  input: UpdateSmtpProfileInput,
): Promise<{ smtpProfile: SmtpProfile }> {
  return apiFetch<{ smtpProfile: SmtpProfile }>(`/smtp-profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSmtpProfile(id: string): Promise<void> {
  return apiFetch<void>(`/smtp-profiles/${id}`, { method: "DELETE" });
}

export function testSmtpProfile(id: string): Promise<SendResult> {
  return apiFetch<SendResult>(`/smtp-profiles/${id}/test`, { method: "POST" });
}

export function sendTestEmail(id: string, to: string): Promise<SendResult> {
  return apiFetch<SendResult>(`/smtp-profiles/${id}/send-test`, {
    method: "POST",
    body: JSON.stringify({ to }),
  });
}

export interface SenderIdentity {
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export interface Newsletter {
  id: string;
  name: string;
  templateId: string | null;
  smtpProfileId: string | null;
  senderIdentity: SenderIdentity | null;
  subjectTemplate: string;
  scheduleCron: string;
  timezone: string;
  isEnabled: boolean;
  lookbackDays: number;
  skipWhenEmpty: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsletterInput {
  name: string;
  scheduleCron: string;
  timezone?: string;
  subjectTemplate?: string;
  lookbackDays?: number;
  skipWhenEmpty?: boolean;
  smtpProfileId?: string;
  templateId?: string;
  senderIdentity?: SenderIdentity;
}

export interface NewsletterDetail {
  newsletter: Newsletter;
  sources: (SourceConnection & { mediaTypeFilter: string[] | null; libraryFilter: string[] | null })[];
  recipientGroups: RecipientGroup[];
}

export interface SendRun {
  id: string;
  newsletterId: string;
  status: "pending" | "running" | "success" | "partial_failure" | "failed" | "skipped";
  startedAt: string | null;
  finishedAt: string | null;
  itemCountIncluded: number;
  recipientCount: number;
  error: string | null;
  itemsSnapshot: { title: string; kind: string }[] | null;
  /** When "Send to the rest" was last used on it. */
  restSentAt?: string | null;
  /** Whether "Send to the rest" can finish it now (newsletter history only). */
  canSendToRest?: boolean;
}

export type SendToRestPlan =
  | {
      available: true;
      alreadySent: number;
      recipients: { id: string; email: string; displayName: string | null; previous: "failed" | "not_sent" }[];
    }
  | { available: false; reason: string };

export interface SendToRestResult {
  status: "success" | "partial_failure" | "failed";
  sent: number;
  failed: number;
}

export interface SendRunRecipientResult {
  recipientId: string;
  email: string;
  displayName: string | null;
  status: "sent" | "bounced" | "failed" | "skipped_unsubscribed";
  error: string | null;
}

export function listNewsletters(): Promise<{ newsletters: Newsletter[] }> {
  return apiFetch<{ newsletters: Newsletter[] }>("/newsletters");
}

export function createNewsletter(input: CreateNewsletterInput): Promise<{ newsletter: Newsletter }> {
  return apiFetch<{ newsletter: Newsletter }>("/newsletters", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNewsletter(
  id: string,
  input: Omit<Partial<CreateNewsletterInput>, "templateId" | "smtpProfileId"> & {
    isEnabled?: boolean;
    templateId?: string | null;
    smtpProfileId?: string | null;
  },
): Promise<{ newsletter: Newsletter }> {
  return apiFetch<{ newsletter: Newsletter }>(`/newsletters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteNewsletter(id: string): Promise<void> {
  return apiFetch<void>(`/newsletters/${id}`, { method: "DELETE" });
}

export function getNewsletterDetail(id: string): Promise<NewsletterDetail> {
  return apiFetch<NewsletterDetail>(`/newsletters/${id}`);
}

export function addNewsletterSource(newsletterId: string, sourceConnectionId: string): Promise<void> {
  return apiFetch<void>(`/newsletters/${newsletterId}/sources`, {
    method: "POST",
    body: JSON.stringify({ sourceConnectionId }),
  });
}

export function removeNewsletterSource(newsletterId: string, sourceConnectionId: string): Promise<void> {
  return apiFetch<void>(`/newsletters/${newsletterId}/sources/${sourceConnectionId}`, {
    method: "DELETE",
  });
}

export function addNewsletterGroup(newsletterId: string, groupId: string): Promise<void> {
  return apiFetch<void>(`/newsletters/${newsletterId}/recipient-groups`, {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });
}

export function removeNewsletterGroup(newsletterId: string, groupId: string): Promise<void> {
  return apiFetch<void>(`/newsletters/${newsletterId}/recipient-groups/${groupId}`, {
    method: "DELETE",
  });
}

export function sendNewsletterNow(id: string): Promise<{ sendRunId: string }> {
  return apiFetch<{ sendRunId: string }>(`/newsletters/${id}/send-now`, { method: "POST" });
}

export interface NewsletterPreview {
  subject: string;
  html: string;
  items: { title: string; kind: string }[];
}

export function previewNewsletter(id: string): Promise<NewsletterPreview> {
  return apiFetch<NewsletterPreview>(`/newsletters/${id}/preview`, { method: "POST" });
}

export function sendTestNewsletter(id: string, to: string): Promise<{ messageId: string }> {
  return apiFetch<{ messageId: string }>(`/newsletters/${id}/send-test`, {
    method: "POST",
    body: JSON.stringify({ to }),
  });
}

export function listSendRuns(newsletterId: string): Promise<{ sendRuns: SendRun[] }> {
  return apiFetch<{ sendRuns: SendRun[] }>(`/newsletters/${newsletterId}/send-runs`);
}

export function listSendRunRecipients(
  newsletterId: string,
  sendRunId: string,
): Promise<{ recipients: SendRunRecipientResult[] }> {
  return apiFetch<{ recipients: SendRunRecipientResult[] }>(
    `/newsletters/${newsletterId}/send-runs/${sendRunId}/recipients`,
  );
}

// Not JSON — the endpoint returns the sent HTML itself
// (Content-Type: text/html), meant to be opened directly rather than
// fetched through apiFetch's JSON parsing.
export function getSendToRestPlan(newsletterId: string, sendRunId: string): Promise<SendToRestPlan> {
  return apiFetch<SendToRestPlan>(`/newsletters/${newsletterId}/send-runs/${sendRunId}/rest`);
}

export function sendToTheRest(newsletterId: string, sendRunId: string): Promise<SendToRestResult> {
  return apiFetch<SendToRestResult>(`/newsletters/${newsletterId}/send-runs/${sendRunId}/send-to-rest`, {
    method: "POST",
  });
}

export function sendRunHtmlUrl(newsletterId: string, sendRunId: string): string {
  return `/api/newsletters/${newsletterId}/send-runs/${sendRunId}/html`;
}

export interface Template {
  id: string;
  name: string;
  // "design": options-based (settings). "code": hand-written MJML in
  // compiledMjml, with settings.content for its intro, footer, and buttons.
  mode: "design" | "code";
  settings: DesignSettings | null;
  compiledMjml: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodeIssue {
  line: number;
  message: string;
}

export interface CodeCheck {
  errors: CodeIssue[];
  warnings: CodeIssue[];
}

/** A code design's issues from a 422 on preview or save, if that's what failed. */
export function codeCheckFrom(err: unknown): CodeCheck | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const issues = (err.body as { issues?: CodeCheck } | undefined)?.issues;
  return issues ?? null;
}

export type DesignPreview = NewsletterPreview & { warnings?: CodeIssue[] };

// Renders unsaved options, or unsaved code (`mjml`) with the design's text
// and buttons from `settings`.
export function previewDesign(
  settings: DesignSettings,
  newsletterId?: string,
  mjml?: string,
): Promise<DesignPreview> {
  return apiFetch<DesignPreview>("/templates/preview", {
    method: "POST",
    body: JSON.stringify({ settings, ...(mjml !== undefined && { mjml }), ...(newsletterId && { newsletterId }) }),
  });
}

export function convertDesignToCode(id: string): Promise<{ template: Template }> {
  return apiFetch<{ template: Template }>(`/templates/${id}/convert-to-code`, { method: "POST" });
}

export function listTemplates(): Promise<{ templates: Template[] }> {
  return apiFetch<{ templates: Template[] }>("/templates");
}

export function createTemplate(input: {
  name: string;
  mode?: Template["mode"];
  settings?: DesignSettings;
  compiledMjml?: string;
}): Promise<{ template: Template }> {
  return apiFetch<{ template: Template }>("/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/templates/${id}`, { method: "DELETE" });
}

export function getTemplate(id: string): Promise<{ template: Template }> {
  return apiFetch<{ template: Template }>(`/templates/${id}`);
}

export function updateTemplate(
  id: string,
  input: {
    name?: string;
    mode?: Template["mode"];
    settings?: DesignSettings;
    compiledMjml?: string;
  },
): Promise<{ template: Template }> {
  return apiFetch<{ template: Template }>(`/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface LogEntry {
  time: number;
  level: number;
  levelLabel: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  msg: string;
  err?: { type?: string; message?: string };
  req?: { method?: string; url?: string };
  res?: { statusCode?: number };
  [key: string]: unknown;
}

export function listLogs(params?: {
  limit?: number;
  level?: LogEntry["levelLabel"];
}): Promise<{ logs: LogEntry[] }> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.level) search.set("level", params.level);
  const query = search.toString();
  return apiFetch<{ logs: LogEntry[] }>(`/logs${query ? `?${query}` : ""}`);
}

export type WebhookFormat = "discord" | "slack" | "ntfy" | "apprise" | "json";

export interface NotificationSettings {
  onFailure: boolean;
  onPartialFailure: boolean;
  onBackupFailure: boolean;
  email: { enabled: boolean; smtpProfileId: string | null; to: string };
  // The saved URL is never sent back, only whether one exists and its host.
  webhook: { enabled: boolean; format: WebhookFormat; hasUrl: boolean; urlHost: string | null };
}

export interface NotificationSettingsInput {
  onFailure: boolean;
  onPartialFailure: boolean;
  onBackupFailure: boolean;
  email: { enabled: boolean; smtpProfileId: string | null; to: string };
  // Omit url to keep the saved one.
  webhook: { enabled: boolean; format: WebhookFormat; url?: string | null };
}

export interface AlertDeliveryResult {
  destination: "email" | "webhook";
  ok: boolean;
  error?: string;
}

export function getNotificationSettings(): Promise<{ settings: NotificationSettings }> {
  return apiFetch<{ settings: NotificationSettings }>("/notifications");
}

export function saveNotificationSettings(input: NotificationSettingsInput): Promise<{ settings: NotificationSettings }> {
  return apiFetch<{ settings: NotificationSettings }>("/notifications", { method: "PUT", body: JSON.stringify(input) });
}

export function sendTestAlert(input: NotificationSettingsInput): Promise<{ results: AlertDeliveryResult[] }> {
  return apiFetch<{ results: AlertDeliveryResult[] }>("/notifications/test", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type BackupTrigger = "scheduled" | "manual" | "pre-upgrade";

export interface BackupFile {
  filename: string;
  createdAt: string;
  version: string;
  trigger: BackupTrigger;
  sizeBytes: number;
}

export type BackupRetention =
  | { mode: "count"; keep: number }
  | { mode: "calendar"; daily: number; weekly: number; monthly: number };

export interface BackupSettings {
  enabled: boolean;
  scheduleCron: string;
  timezone: string;
  retention: BackupRetention;
}

export interface BackupOverview {
  backups: BackupFile[];
  settings: BackupSettings;
  lastRun: { at: string; ok: boolean; trigger: BackupTrigger; filename?: string; error?: string } | null;
  nextRun: string | null;
  location: { path: string; fromEnv: boolean; sameDiskAsDatabase: boolean | null };
}

export function getBackups(): Promise<BackupOverview> {
  return apiFetch<BackupOverview>("/backups");
}

export function createBackupNow(): Promise<{ backup: BackupFile }> {
  return apiFetch<{ backup: BackupFile }>("/backups", { method: "POST" });
}

export function saveBackupSettings(settings: BackupSettings): Promise<BackupOverview> {
  return apiFetch<BackupOverview>("/backups/settings", { method: "PUT", body: JSON.stringify(settings) });
}

export function deleteBackup(filename: string): Promise<void> {
  return apiFetch<void>(`/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
}

/** A plain link target: the browser downloads the file itself. */
export function backupDownloadUrl(filename: string): string {
  return `/api/backups/${encodeURIComponent(filename)}/download`;
}
