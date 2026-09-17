// Redirects to a short-lived signed URL for an evidence file.
// Visibility is decided by RLS on `evidences` (queried with the caller's session);
// only after that does the service role sign the private storage object.
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Bad evidence id' })

  const client = await serverSupabaseClient(event)
  const { data, error } = await client.from('evidences').select('storage_path, owner_id, milestone_id').eq('id', id).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: 'Lookup failed' })
  if (!data?.storage_path) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  // The database enforces this too; never sign a path outside the evidence owner's folder.
  if (!data.storage_path.startsWith(`${data.owner_id}/${data.milestone_id}/`)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const { data: signed, error: signError } = await serverSupabaseServiceRole(event)
    .storage.from('evidence').createSignedUrl(data.storage_path, 300)
  if (signError || !signed) throw createError({ statusCode: 500, statusMessage: 'Could not sign' })

  setHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, signed.signedUrl, 302)
})
