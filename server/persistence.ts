type TableRow = Record<string, unknown>;

const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const enabled = Boolean(baseUrl && serviceRoleKey);

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(path: string, init: RequestInit = {}) {
  if (!enabled) return null;
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase persistence error ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const persistence = {
  enabled,

  async list(table: string): Promise<TableRow[]> {
    const data = await request(`${table}?select=*`);
    return Array.isArray(data) ? data : [];
  },

  async upsert(table: string, row: TableRow, conflict = 'id'): Promise<void> {
    await request(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(row),
    });
  },

  async remove(table: string, id: string): Promise<void> {
    await request(`${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers({ Prefer: 'return=minimal' }),
    });
  },
};
