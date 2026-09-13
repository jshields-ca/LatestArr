export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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

export function createSource(input: CreateSourceInput): Promise<{ source: SourceConnection }> {
  return apiFetch<{ source: SourceConnection }>("/sources", {
    method: "POST",
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
  input: { displayName?: string; isActive?: boolean },
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
