# Implementation Plan: Website Performance Optimization

## Overview

Apply nine layered performance optimizations to the SMS Marketing Dashboard, ordered by impact. Each task is self-contained and builds on the previous ones. The implementation language is TypeScript/React (Next.js App Router).

## Tasks

- [x] 1. Next.js configuration optimizations
  - [x] 1.1 Install `@next/bundle-analyzer` as a dev dependency
    - Run `npm install -D @next/bundle-analyzer` inside `frontend/`
    - _Requirements: 5.6_

  - [x] 1.2 Update `frontend/next.config.ts` with compiler and image optimizations
    - Import `bundleAnalyzer` from `@next/bundle-analyzer` and wrap the config export with `withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })`
    - Add `experimental: { optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'] }` — this is the single biggest bundle win; lucide-react v0.563 ships 1400+ icons and without this the entire library is bundled
    - Confirm `compress: true` is already set (it is); leave it in place
    - Add `images: { formats: ['image/avif', 'image/webp'], minimumCacheTTL: 604800, deviceSizes: [640, 750, 828, 1080, 1200] }`
    - Keep the existing `/api/:path*` rewrite unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2. Supabase browser client singleton
  - [x] 2.1 Rewrite `frontend/src/lib/supabase/client.ts` to use a module-level singleton
    - Declare `let _client: SupabaseClient | null = null` at module scope
    - In `createClient()`, guard with `if (_client) return _client` before calling `createBrowserClient`
    - Add explicit env-var guards: throw a descriptive `Error` if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is falsy
    - The singleton resets automatically on full page reload (module re-evaluation), satisfying Requirement 1.3
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]2.2 Write property test for Supabase client singleton identity (Property 1)
    - Install `fast-check` as a dev dependency: `npm install -D fast-check` inside `frontend/`
    - Create `frontend/src/__tests__/lib/supabase/client.test.ts`
    - Use `fc.nat({ max: 20 })` to generate a random call count N; call `createClient()` N+2 times and assert every result is `===` to the first
    - Reset the module singleton between test runs using `jest.resetModules()` or by directly setting the module-level variable via a test export
    - **Property 1: Supabase client singleton identity**
    - **Validates: Requirement 1.1**

- [x] 3. Auth context and dashboard layout optimization
  - [x] 3.1 Update `AuthProvider` in `frontend/src/contexts/auth-context.tsx` to accept `initialUser` and `initialProfile` props
    - Add `initialUser?: User | null` and `initialProfile?: UserProfile | null` to `AuthProviderProps`
    - Initialize `useState` with the provided values: `useState<User | null>(initialUser ?? null)` and `useState<UserProfile | null>(initialProfile ?? null)`
    - Set initial `isLoading` to `!initialUser` so the loading spinner is skipped when server data is provided
    - In `useEffect`, skip the initial `fetchProfile()` call when `initialUser` is truthy — only register the `onAuthStateChange` subscription
    - The `onAuthStateChange` handler must still call `fetchProfile()` on `SIGNED_IN` / `TOKEN_REFRESHED` and clear state on `SIGNED_OUT` (satisfying Requirements 7.4 and 7.5)
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 3.2 Pass server-fetched user and profile into `AuthProvider` from `frontend/src/app/(dashboard)/layout.tsx`
    - The layout already fetches `user` and `profile` server-side; pass them as `initialUser={user}` and `initialProfile={profile}` on the `<AuthProvider>` JSX element
    - No new Supabase calls are needed — the existing server-side fetch is sufficient
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]3.3 Write property test for AuthProvider initial props (Property 2)
    - Create `frontend/src/__tests__/contexts/auth-context.test.tsx`
    - Use `fc.record({ id: fc.uuid(), email: fc.emailAddress() })` to generate arbitrary `User`-shaped objects and `fc.record({ id: fc.uuid(), role: fc.constantFrom('agency_admin', 'restaurant_admin') })` for profiles
    - For each generated pair, render `<AuthProvider initialUser={...} initialProfile={...}>` and assert `isLoading === false` immediately after mount without any async waiting
    - Mock `createClient` to assert `getUser` and `rpc('get_my_profile')` are never called during the initial render
    - **Property 2: AuthProvider skips mount fetch when initial data is provided**
    - **Validates: Requirements 7.2, 7.3**

- [x] 4. TanStack Query cache tuning
  - [x] 4.1 Update `QueryClient` defaults in `frontend/src/components/providers.tsx`
    - Change `staleTime` from `60 * 1000` to `2 * 60 * 1000` (2 minutes)
    - Add `gcTime: 10 * 60 * 1000` (10 minutes)
    - Add `retry: 1`
    - Keep `refetchOnWindowFocus: false`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Add per-query `staleTime` overrides in `frontend/src/lib/queries.ts`
    - In `useRestaurantStats`: add `staleTime: 5 * 60 * 1000` (5 minutes) — stats change infrequently
    - In `useRestaurantMessages`: add `staleTime: 30 * 1000` (30 seconds) — messages are near-real-time
    - _Requirements: 2.5, 2.6_

  - [ ]4.3 Write property test for query key serializability (Property 4)
    - Create `frontend/src/__tests__/lib/queries.test.ts`
    - Use `fc.tuple(fc.uuid(), fc.string(), fc.option(fc.string()))` to generate arbitrary `[id, filter, status]` combinations
    - For each combination, construct the query key shapes used in `queries.ts` (e.g., `['restaurants', id, 'stats']`, `['campaigns', restaurantId, status]`) and assert `JSON.stringify(key)` does not throw
    - **Property 4: Query keys are always JSON-serializable**
    - **Validates: Requirement 9.4**

- [x] 5. Agency dashboard combined query
  - [x] 5.1 Add `useAgencyDashboardData` hook to `frontend/src/lib/queries.ts`
    - Import `statsApi` and `transactionApi` from `./api`
    - Implement `useAgencyDashboardData(agencyId: string | undefined)` using a single `useQuery` call
    - Inside `queryFn`, use `Promise.all([agencyApi.getRestaurants(agencyId), statsApi.getAgencyStats(agencyId), transactionApi.getAgencyTransactions(agencyId)])` to fetch all three in parallel
    - Return `{ restaurants, stats, transactions }` from the combined result
    - Set `staleTime: 3 * 60 * 1000` and `enabled: !!agencyId`
    - Use query key `['agency-dashboard', agencyId]`
    - _Requirements: 9.1, 9.2_

  - [x] 5.2 Refactor `frontend/src/app/(dashboard)/agency/dashboard/page.tsx` to use the combined query
    - Replace the four separate `useAgencies`, `useAgencyRestaurants`, and two inline `useQuery` calls with a single `useAgencies()` call (to get `agencyId`) and one `useAgencyDashboardData(agencyId)` call
    - Destructure `restaurants`, `stats`, and `transactions` from the combined query result
    - Update all references in the component to use the new data shape
    - _Requirements: 9.1, 9.2_

- [x] 6. Code splitting with dynamic imports
  - [x] 6.1 Replace static imports of `SchedulerHeatmap` and `DeadHourScheduler` in `frontend/src/app/(dashboard)/restaurant/campaigns/page.tsx` and `frontend/src/app/(dashboard)/restaurant/campaigns/new/page.tsx`
    - Use `next/dynamic` with `ssr: false` and a `loading` fallback showing `<Loader2 className="h-6 w-6 animate-spin" />`
    - Wrap each dynamic import in a `.catch()` that returns `{ default: () => <p className="text-destructive">Failed to load scheduler. Please refresh.</p> }` to satisfy Requirement 3.4
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 6.2 Replace static imports of `TwilioNumberPicker` in all three pages that use it
    - Files: `frontend/src/app/(dashboard)/agency/phone-numbers/page.tsx`, `frontend/src/app/(dashboard)/agency/restaurants/[restaurantId]/phone/page.tsx`, and `frontend/src/app/(dashboard)/restaurant/settings/page.tsx`
    - Apply the same `next/dynamic` pattern with `ssr: false`, loading indicator, and error fallback
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 7. React rendering optimizations
  - [x] 7.1 Wrap `StatCard` with `React.memo` in `frontend/src/app/(dashboard)/restaurant/dashboard/page.tsx`
    - Change `function StatCard(...)` to `const StatCard = React.memo(function StatCard(...) { ... })`
    - Add `import React from 'react'` if not already present
    - _Requirements: 4.1, 4.3_

  - [x] 7.2 Extract `NavContent` from inside `Sidebar` to module scope in `frontend/src/components/layout/sidebar.tsx`
    - Define a new `SidebarNavContent` component at module level (outside the `Sidebar` function body) accepting all required values as explicit props: `navItems`, `pathname`, `isImpersonating`, `userEmail`, `businessName`, `userRole`, `onMobileClose`, `onLogout`, `onStopManaging`
    - Replace the inline `const NavContent = () => (...)` definition inside `Sidebar` with a call to `<SidebarNavContent ...props />`
    - Wrap `SidebarNavContent` with `React.memo`
    - Wrap `handleLogout` and `handleStopManaging` with `useCallback` in `Sidebar` before passing them as props
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]7.3 Write property test for memoized component re-render behavior (Property 3)
    - Create `frontend/src/__tests__/components/stat-card.test.tsx`
    - Use `fc.record({ title: fc.string(), value: fc.string(), change: fc.option(fc.string()) })` to generate arbitrary prop sets
    - For each prop set, render `StatCard` twice with identical props and assert the render function is called exactly once (use `jest.spyOn` on `React.memo`'s inner function or a render counter ref)
    - **Property 3: Memoized components do not re-render on stable props**
    - **Validates: Requirement 4.3**

- [x] 8. Font loading optimization
  - [x] 8.1 Update `Inter` font configuration in `frontend/src/app/layout.tsx`
    - Add `display: 'swap'` to the `Inter` options object
    - Add `preload: true`
    - Add `variable: '--font-inter'`
    - Apply the variable class to the `<html>` element: `className={inter.variable}`
    - Change `<body className={inter.className}>` to `<body className="font-sans">` so Tailwind picks up the CSS variable
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Sidebar link prefetching
  - [x] 9.1 Add `prefetch={true}` to navigation `Link` components in `frontend/src/components/layout/sidebar.tsx`
    - In the `navItems.map(...)` render loop, add `prefetch={true}` to each `<Link>` element
    - This causes Next.js to prefetch page data on hover, making navigation feel instant
    - _Requirements: 9.3_

- [x] 10. Checkpoint — verify all changes compile and tests pass
  - Run `npm run build` inside `frontend/` and confirm zero TypeScript errors and a successful production build
  - Run `ANALYZE=true npm run build` and confirm the bundle analyzer report opens, showing `lucide-react` is tree-shaken
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Priority order follows the design document: Next.js config → Supabase singleton → Auth optimization → Query cache → Agency combined query → Code splitting → React memoization → Font loading → Prefetching
- Property tests require `fast-check` (install once in task 2.2); unit tests use the existing test runner
- The Supabase singleton (`client.ts`) is browser-only — never use it in Server Components or API routes, which use `createServerClient` from `@supabase/ssr`
- `ANALYZE=true npm run build` output should not be committed; add `.next/analyze/` to `.gitignore` if not already present
