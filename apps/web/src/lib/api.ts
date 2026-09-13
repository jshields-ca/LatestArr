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
