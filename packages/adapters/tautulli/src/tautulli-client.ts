export interface TautulliLibrary {
  section_id: string;
  section_name: string;
  section_type: string;
}

export interface TautulliRecentlyAddedItem {
  rating_key: string;
  title: string;
  full_title: string;
  media_type: string;
  added_at: string;
  originally_available_at?: string;
  summary?: string;
  genres?: string[];
}

interface TautulliEnvelope<T> {
  response: {
    result: "success" | "error";
    message: string | null;
    data: T;
  };
}

function buildUrl(
  baseUrl: string,
  cmd: string,
  apiKey: string,
  params: Record<string, string> = {},
): URL {
  // Concatenate rather than resolve as a relative URL, so any HTTP_ROOT
  // subpath in baseUrl (e.g. "http://host:8181/tautulli") is preserved
  // instead of being replaced by a leading-slash path.
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${trimmedBase}/api/v2`);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("cmd", cmd);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function callTautulli<T>(
  baseUrl: string,
  apiKey: string,
  cmd: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = buildUrl(baseUrl, cmd, apiKey, params);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Tautulli request failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as TautulliEnvelope<T>;
  if (body.response.result !== "success") {
    throw new Error(body.response.message ?? "Tautulli API returned an error");
  }
  return body.response.data;
}

export async function getLibraries(baseUrl: string, apiKey: string): Promise<TautulliLibrary[]> {
  return callTautulli<TautulliLibrary[]>(baseUrl, apiKey, "get_libraries");
}

export async function getRecentlyAdded(
  baseUrl: string,
  apiKey: string,
  count: number,
  sectionId?: string,
): Promise<TautulliRecentlyAddedItem[]> {
  const params: Record<string, string> = { count: String(count) };
  if (sectionId) {
    params.section_id = sectionId;
  }
  const data = await callTautulli<{ recently_added: TautulliRecentlyAddedItem[] }>(
    baseUrl,
    apiKey,
    "get_recently_added",
    params,
  );
  return data.recently_added;
}
