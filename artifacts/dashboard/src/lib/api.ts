const BASE = `${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiGet  = <T>(path: string)                        => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown)        => request<T>(path, { method: "POST",  body: JSON.stringify(body) });
export const apiPut  = <T>(path: string, body?: unknown)        => request<T>(path, { method: "PUT",   body: JSON.stringify(body) });
export const apiPatch= <T>(path: string, body?: unknown)        => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDel  = <T>(path: string)                        => request<T>(path, { method: "DELETE" });
