// Confirms the reviewed courses and deletes the PDF in the same request, so the file is gone
// even if the browser closes right after the student clicks Confirm.
// POST { upload_id, program_id, grad_year, courses } with the student's JWT.
import { clients, cors, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const { user, service } = clients(req)
  const body = await req.json().catch(() => null)
  if (!body?.upload_id) return json({ error: 'bad_request', message: 'Send { upload_id, program_id, grad_year, courses }.' }, 400)

  // Read the path through RLS first: only the owner can see it.
  const { data: upload } = await user.from('transcript_uploads').select('storage_path').eq('id', body.upload_id).maybeSingle()
  if (!upload) return json({ error: 'upload_not_found', message: 'No upload with that id.' }, 404)

  const { data, error } = await user.rpc('confirm_transcript', {
    p_upload_id: body.upload_id,
    p_program_id: body.program_id,
    p_grad_year: body.grad_year,
    p_courses: body.courses,
  })
  if (error) return json({ error: error.message, message: error.details ?? error.message }, 400)

  const removed = await service.storage.from('transcripts').remove([upload.storage_path])
  if (!removed.error) await service.rpc('mark_transcript_file_deleted', { p_upload_id: body.upload_id })

  return json({ ...data, file_deleted: !removed.error })
})
