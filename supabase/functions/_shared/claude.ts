// Shared Claude client for the Edge Functions. The API key lives only in Edge Function secrets
// (ANTHROPIC_API_KEY); it never reaches the browser.
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'

/** BRIEF §3: default to the current Sonnet model. */
export const MODEL = 'claude-sonnet-5-5'

export class NotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set in the Edge Function secrets.')
  }
}

export class ModelOutputError extends Error {}

let client: Anthropic | null = null
function anthropic(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new NotConfiguredError()
  client ??= new Anthropic({ apiKey })
  return client
}

export interface StrictTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/**
 * One structured call: the model must answer through `tool`, whose schema is enforced with
 * strict mode. Claude Sonnet 5.5 rejects forced tool_choice, so the call uses `auto` plus an
 * explicit instruction, and we verify a tool_use block came back (re-asking once if not).
 * Server-side refusal fallbacks are on ("default" routes by refusal category).
 */
export async function callTool<T>(opts: {
  system: string
  content: Anthropic.Beta.BetaContentBlockParam[]
  tool: StrictTool
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
}): Promise<T> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: opts.content }]
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: opts.system,
      tools: [{ ...opts.tool, strict: true } as Anthropic.Beta.BetaTool],
      tool_choice: { type: 'auto' },
      output_config: { effort: opts.effort ?? 'medium' },
      messages,
    })
    if (response.stop_reason === 'refusal') {
      throw new ModelOutputError('The model declined this request.')
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ModelOutputError('The model ran out of room before finishing. Try a shorter document.')
    }
    const call = response.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === opts.tool.name)
    if (call) return call.input as T
    // No tool call: keep the conversation append-only and ask once more.
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: `Answer by calling the ${opts.tool.name} tool exactly once.` })
  }
  throw new ModelOutputError('The model did not return structured output.')
}
