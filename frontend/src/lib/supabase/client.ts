import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (_client) return _client

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Add it to your .env.local file.'
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add it to your .env.local file.'
    )
  }

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  return _client
}
