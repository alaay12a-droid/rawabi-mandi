import { Platform } from "react-native";

const PRODUCTION_API = "https://mandi-menu-1.replit.app";

export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
  (Platform.OS === "web" ? "" : PRODUCTION_API);

// Always an absolute URL — used when saving storage URLs to the DB so the
// APK (which cannot resolve relative URLs) can load images correctly.
export const STORAGE_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
  PRODUCTION_API;

// Log API base on startup so it's visible in logcat / Metro
console.log(`[API] BASE_URL = "${API_BASE}" | EXPO_PUBLIC_API_BASE_URL = "${process.env.EXPO_PUBLIC_API_BASE_URL ?? "(not set)"}"`);

function logReq(method: string, url: string, status: number) {
  if (status >= 400) {
    console.warn(`[API] ${method} ${url} → ${status}`);
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  logReq("POST", url, res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url);
  logReq("GET", url, res.status);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  logReq("PATCH", url, res.status);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  logReq("PUT", url, res.status);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, { method: "DELETE" });
  logReq("DELETE", url, res.status);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
