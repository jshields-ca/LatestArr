export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
    throw new ApiError(response.status, message);
  }

  return body as T;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

export interface AuthProviders {
  local: boolean;
  oidc: boolean;
  needsSetup: boolean;
}

export function getAuthProviders(): Promise<AuthProviders> {
  return apiFetch<AuthProviders>("/auth/providers");
}

export function getVersion(): Promise<{ version: string }> {
  return apiFetch<{ version: string }>("/version");
}

export function getCurrentUser(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/me");
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
  input: { name?: string; baseUrl?: string; credentials?: Record<string, string> },
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

export function deleteGroup(id: string): Promise<void> {
  return apiFetch<void>(`/recipient-groups/${id}`, { method: "DELETE" });
}

export function getGroupMembers(id: string): Promise<{ group: RecipientGroup; members: Recipient[] }> {
  return apiFetch<{ group: RecipientGroup; members: Recipient[] }>(`/recipient-groups/${id}`);
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsletterInput {
  name: string;
  scheduleCron: string;
  timezone?: string;
  subjectTemplate?: string;
  lookbackDays?: number;
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
  status: "pending" | "running" | "success" | "partial_failure" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  itemCountIncluded: number;
  recipientCount: number;
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
  input: Omit<Partial<CreateNewsletterInput>, "templateId"> & {
    isEnabled?: boolean;
    templateId?: string | null;
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

export function listSendRuns(newsletterId: string): Promise<{ sendRuns: SendRun[] }> {
  return apiFetch<{ sendRuns: SendRun[] }>(`/newsletters/${newsletterId}/send-runs`);
}

export interface Template {
  id: string;
  name: string;
  designJson: Record<string, unknown> | null;
  compiledMjml: string | null;
  compiledHtml: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listTemplates(): Promise<{ templates: Template[] }> {
  return apiFetch<{ templates: Template[] }>("/templates");
}

export function createTemplate(input: { name: string }): Promise<{ template: Template }> {
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
  input: { name?: string; designJson?: Record<string, unknown>; compiledMjml?: string },
): Promise<{ template: Template }> {
  return apiFetch<{ template: Template }>(`/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
