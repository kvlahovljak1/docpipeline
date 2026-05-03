import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY  = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[supabase] Missing env vars — check your .env file');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Documents ──────────────────────────────────────────────────────────────

export async function fetchAllDocs() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  // Re-hydrate: parse extracted JSON string back to object
  return (data || []).map(hydrateDoc);
}

export async function insertDoc(doc) {
  const { data, error } = await supabase
    .from('documents')
    .insert([dehydrateDoc(doc)])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return hydrateDoc(data);
}

export async function updateDoc(id, fields, status) {
  const { data, error } = await supabase
    .from('documents')
    .update({ extracted: JSON.stringify(fields), status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return hydrateDoc(data);
}

export async function deleteDoc(id) {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function dehydrateDoc(doc) {
  return {
    id:         doc.id,
    name:       doc.name,
    file_type:  doc.type || '',
    status:     doc.status,
    extracted:  JSON.stringify(doc.extracted || {}),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function hydrateDoc(row) {
  let extracted = {};
  try { extracted = JSON.parse(row.extracted || '{}'); } catch {}
  return {
    id:       row.id,
    name:     row.name,
    type:     row.file_type,
    status:   row.status,
    extracted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
