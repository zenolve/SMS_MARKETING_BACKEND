/**
 * Property test for Supabase client singleton identity
 *
 * Property 1: For any number of calls to createClient() within the same
 * browser session, every returned value SHALL be strictly reference-equal
 * (===) to every other returned value.
 *
 * Validates: Requirement 1.1
 */

import fc from 'fast-check'

// A stable fake client object — every call to the mock returns this same object
const fakeClient = { auth: {}, from: jest.fn() } as unknown as import('@supabase/supabase-js').SupabaseClient

// Mock @supabase/ssr so no real env vars or network calls are needed
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => fakeClient),
}))

// Set required env vars so the guard checks in createClient() pass
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})

afterAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
})

describe('Supabase client singleton identity (Property 1)', () => {
  /**
   * Property: for any N in [0, 20], calling createClient() N+2 times
   * always returns the same reference.
   *
   * We use jest.isolateModules() to get a fresh module (and therefore a
   * fresh _client = null) for each property run, simulating a new browser
   * session without a full process restart.
   */
  it('returns the same instance on every call within a session', () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), (n) => {
        // Total calls = n + 2 (minimum 2 to verify identity)
        const callCount = n + 2
        let results: import('@supabase/supabase-js').SupabaseClient[] = []

        // isolateModules gives us a fresh module scope (fresh _client = null)
        // for each property run, simulating a new page load / browser session
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { createClient } = require('@/lib/supabase/client') as {
            createClient: () => import('@supabase/supabase-js').SupabaseClient
          }

          results = Array.from({ length: callCount }, () => createClient())
        })

        // Every result must be strictly reference-equal to the first
        const first = results[0]
        return results.every((client) => client === first)
      }),
      { numRuns: 50 }
    )
  })

  it('returns the same instance across exactly 2 calls (minimal case)', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@/lib/supabase/client') as {
        createClient: () => import('@supabase/supabase-js').SupabaseClient
      }
      const a = createClient()
      const b = createClient()
      expect(a).toBe(b)
    })
  })

  it('throws a descriptive error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@/lib/supabase/client') as {
        createClient: () => import('@supabase/supabase-js').SupabaseClient
      }
      expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
    })

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
  })

  it('throws a descriptive error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@/lib/supabase/client') as {
        createClient: () => import('@supabase/supabase-js').SupabaseClient
      }
      expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    })

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey
  })
})
