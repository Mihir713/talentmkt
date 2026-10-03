import postgres from 'postgres'

/** Direct connection to the local Supabase Postgres (trusted backend: no JWT claims). */
export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export function connect(options: postgres.Options<Record<string, postgres.PostgresType>> = {}) {
  return postgres(DATABASE_URL, { onnotice: () => {}, max: 1, ...options })
}
