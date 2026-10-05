type TableName = 'articles' | 'categories' | 'sources' | 'automation_logs' | 'site_settings';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isRemotePersistenceConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function loadPayloads<T>(table: TableName): Promise<T[]> {
  if (!isRemotePersistenceConfigured) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=payload&order=updated_at.asc`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Supabase load failed for ${table}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ payload: T }>;
  return rows.map((row) => row.payload).filter(Boolean);
}

export async function upsertPayload(table: TableName, id: string, payload: unknown): Promise<void> {
  if (!isRemotePersistenceConfigured) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ id, payload, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed for ${table}: ${res.status} ${await res.text()}`);
}

export async function deletePayload(table: TableName, id: string): Promise<void> {
  if (!isRemotePersistenceConfigured) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(`Supabase delete failed for ${table}: ${res.status} ${await res.text()}`);
}

export async function testRemotePersistence(): Promise<{ configured: boolean; reachable: boolean; message: string }> {
  if (!isRemotePersistenceConfigured) {
    return { configured: false, reachable: false, message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.' };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=id&limit=1`, { headers: headers() });
    return {
      configured: true,
      reachable: res.ok,
      message: res.ok ? 'Supabase persistence is reachable.' : `Supabase returned HTTP ${res.status}: ${await res.text()}`,
    };
  } catch (error) {
    return { configured: true, reachable: false, message: error instanceof Error ? error.message : String(error) };
  }
}
