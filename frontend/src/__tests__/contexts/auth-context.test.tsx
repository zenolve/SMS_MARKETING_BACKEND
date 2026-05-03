/**
 * @jest-environment jsdom
 *
 * Property test for AuthProvider initial props
 *
 * Property 2: For any valid User object and UserProfile object passed as
 * initialUser and initialProfile to AuthProvider, the provider SHALL
 * initialize with isLoading === false and SHALL NOT invoke
 * supabase.auth.getUser() or rpc('get_my_profile') during the initial
 * render lifecycle.
 *
 * Validates: Requirements 7.2, 7.3
 */

import React, { useContext } from 'react'
import { render } from '@testing-library/react'
import fc from 'fast-check'

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/client BEFORE importing AuthProvider so the module
// system resolves the mock when auth-context.tsx calls createClient().
// ---------------------------------------------------------------------------

const mockGetUser = jest.fn()
const mockRpc = jest.fn()
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
    rpc: mockRpc,
  })),
}))

// Import AuthProvider AFTER the mock is set up
import { AuthProvider } from '@/contexts/auth-context'

// ---------------------------------------------------------------------------
// Helper: a minimal React context consumer that exposes isLoading via a
// data-testid attribute so we can assert on it synchronously.
// ---------------------------------------------------------------------------

// We need to access the AuthContext value. AuthProvider exports useAuth, but
// we want to read the raw context value without throwing. We'll render a
// child that captures the value via useAuth.
import { useAuth } from '@/contexts/auth-context'

function IsLoadingCapture({ onCapture }: { onCapture: (v: boolean) => void }) {
  const { isLoading } = useAuth()
  // Capture synchronously during render (before any effects run)
  onCapture(isLoading)
  return null
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AuthProvider initial props (Property 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Ensure onAuthStateChange always returns a valid subscription object
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })
  })

  /**
   * Property 2: AuthProvider skips mount fetch when initial data is provided.
   *
   * For any arbitrary User-shaped object and UserProfile-shaped object,
   * rendering AuthProvider with those as initialUser/initialProfile must:
   *   1. Set isLoading to false immediately (no async waiting)
   *   2. Never call supabase.auth.getUser()
   *   3. Never call supabase.rpc('get_my_profile')
   *
   * Validates: Requirements 7.2, 7.3
   */
  it('initializes isLoading=false and skips Supabase calls for any valid initial data', () => {
    // Arbitrary User-shaped object (subset of fields AuthProvider cares about)
    const userArb = fc.record({
      id: fc.uuid(),
      email: fc.emailAddress(),
    })

    // Arbitrary UserProfile-shaped object
    const profileArb = fc.record({
      id: fc.uuid(),
      role: fc.constantFrom('agency_admin', 'restaurant_admin') as fc.Arbitrary<'agency_admin' | 'restaurant_admin'>,
    })

    fc.assert(
      fc.property(userArb, profileArb, (user, profile) => {
        jest.clearAllMocks()
        mockOnAuthStateChange.mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        })

        let capturedIsLoading: boolean | undefined

        const { unmount } = render(
          <AuthProvider
            initialUser={user as unknown as import('@supabase/supabase-js').User}
            initialProfile={profile as unknown as Parameters<typeof AuthProvider>[0]['initialProfile']}
          >
            <IsLoadingCapture onCapture={(v) => { capturedIsLoading = v }} />
          </AuthProvider>
        )

        // Assert isLoading is false immediately after mount (synchronous)
        expect(capturedIsLoading).toBe(false)

        // Assert no Supabase auth calls were made during initial render
        expect(mockGetUser).not.toHaveBeenCalled()
        expect(mockRpc).not.toHaveBeenCalled()

        unmount()
      }),
      { numRuns: 50 }
    )
  })

  /**
   * Concrete example: verify the property holds for a specific known user/profile pair.
   */
  it('does not show loading state when initialUser is provided (concrete example)', () => {
    const mockUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
    } as unknown as import('@supabase/supabase-js').User

    const mockProfile = {
      id: '00000000-0000-0000-0000-000000000001',
      role: 'restaurant_admin' as const,
      is_verified: true,
      business_name: 'Test Restaurant',
      restaurant_id: '00000000-0000-0000-0000-000000000002',
    }

    let capturedIsLoading: boolean | undefined

    const { unmount } = render(
      <AuthProvider initialUser={mockUser} initialProfile={mockProfile}>
        <IsLoadingCapture onCapture={(v) => { capturedIsLoading = v }} />
      </AuthProvider>
    )

    expect(capturedIsLoading).toBe(false)
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()

    unmount()
  })

  /**
   * Verify that when NO initial data is provided, isLoading starts as true
   * (the default behavior — ensures the property is meaningful).
   */
  it('starts with isLoading=true when no initialUser is provided', () => {
    // fetchProfile will be called but we don't want it to resolve
    mockGetUser.mockReturnValue(new Promise(() => {})) // never resolves

    let capturedIsLoading: boolean | undefined

    const { unmount } = render(
      <AuthProvider>
        <IsLoadingCapture onCapture={(v) => { capturedIsLoading = v }} />
      </AuthProvider>
    )

    expect(capturedIsLoading).toBe(true)

    unmount()
  })
})
