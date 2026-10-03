import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/** The caller's client (their JWT, so RLS and auth.uid() apply) and a service-role client. */
export function clients(req: Request): { user: SupabaseClient; service: SupabaseClient } {
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = req.headers.get('Authorization') ?? ''
  return {
    user: createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }),
    service: createClient(url, serviceKey, { auth: { persistSession: false } }),
  }
}

export async function requireAdmin(user: SupabaseClient): Promise<Response | null> {
  const { data, error } = await user.rpc('is_admin')
  if (error || data !== true) return json({ error: 'forbidden', message: 'This action is for admins only.' }, 403)
  return null
}
