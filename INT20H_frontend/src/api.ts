export interface Order {
  id: number;
  latitude: number;
  longitude: number;
  subtotal: number;
  timestamp: string;
  zip_code: string | null;
  state: string;
  tax_region: string;
  state_rate: number;
  county_rate: number;
  city_rate: number;
  special_rate: number;
  composite_tax_rate: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

export interface OrdersResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  orders: Order[];
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: { original_id: string; error: string }[];
}

const BASE = "/api";

function getToken() {
  return localStorage.getItem("token") || "";
}

function headers(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  };
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Wrong password");
  const data = await res.json();
  return data.token;
}

export async function logout() {
  await fetch(`${BASE}/logout`, {
    method: "POST",
    headers: headers(),
  });
}

export async function getOrders(params: {
  page?: number;
  limit?: number;
  state?: string;
  zip_code?: string;
  min_total?: string;
  max_total?: string;
}): Promise<OrdersResponse> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, String(v)));
  const res = await fetch(`${BASE}/orders?${q}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function createOrder(data: {
  latitude: number;
  longitude: number;
  subtotal: number;
  timestamp?: string;
}): Promise<Order> {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create order");
  return json;
}

export async function importOrders(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/orders/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Import failed");
  return json;
}

export async function clearOrders(): Promise<void> {
  const res = await fetch(`${BASE}/orders`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error("Failed to clear orders");
}