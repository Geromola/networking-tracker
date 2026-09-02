// lib/api.ts — every call the app makes to its own backend.
//
// One module owns request shape and error wording, which keeps error handling
// out of the components and makes the failure paths easy to reason about.

import { getAccessToken } from "./auth.ts";

export type Priority = "high" | "medium" | "low";

export type Contact = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  where_met: string | null;
  notes: string | null;
  priority: Priority;
  created_at: string;
  updated_at: string;
};

export type ContactDraft = {
  name: string;
  company: string;
  role: string;
  where_met: string;
  notes: string;
  priority: Priority;
};

/**
 * An error carrying the backend's per-field messages, so a form can show the
 * message next to the input that caused it rather than only in a toast.
 */
export class ApiError extends Error {
  fields: Record<string, string>;
  status: number;

  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch {
    // fetch rejects (rather than resolving) when the network itself fails.
    throw new ApiError(NETWORK_MESSAGE, 0);
  }

  if (response.status === 204) return undefined as T;

  // A 500 can return an HTML error page, which would make response.json() throw.
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      body?.error?.fields ?? {},
    );
  }

  return body as T;
}

export type ListOptions = {
  sort: "name" | "created_at" | "priority";
  order: "asc" | "desc";
  priority: Priority | "all";
  search: string;
};

export async function listContacts(options: ListOptions): Promise<Contact[]> {
  const params = new URLSearchParams({
    sort: options.sort,
    order: options.order,
  });
  if (options.priority !== "all") params.set("priority", options.priority);
  if (options.search.trim()) params.set("search", options.search.trim());

  const body = await request<{ contacts: Contact[] }>(`/api/contacts?${params}`);
  return body.contacts;
}

export async function createContact(draft: ContactDraft): Promise<Contact> {
  const body = await request<{ contact: Contact }>("/api/contacts", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return body.contact;
}

export async function updateContact(
  id: string,
  draft: ContactDraft,
): Promise<Contact> {
  const body = await request<{ contact: Contact }>(`/api/contacts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(draft),
  });
  return body.contact;
}

export async function deleteContact(id: string): Promise<void> {
  await request<void>(`/api/contacts/${id}`, { method: "DELETE" });
}
