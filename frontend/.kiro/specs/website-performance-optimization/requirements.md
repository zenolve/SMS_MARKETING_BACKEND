# Requirements Document

## Introduction

The SMS Marketing Dashboard is a Next.js 14 App Router application serving three user roles: admin, agency, and restaurant. The application currently suffers from slow perceived load times caused by a combination of redundant Supabase client instantiation, an untuned TanStack Query cache, no code splitting for heavy components, missing Next.js compiler and image optimizations, and a client-side auth waterfall that blocks every dashboard render.

This document defines the functional requirements for resolving these performance issues across nine optimization areas. All changes are additive and non-breaking — no existing API contracts or data models are altered.

---

## Glossary

- **Supabase_Client_Module**: The browser-side Supabase client factory at `src/lib/supabase/client.ts`
- **SupabaseClient**: The singleton instance of the Supabase browser client returned by `createClient()`
- **QueryClient**: The TanStack Query client instance configured in `src/components/providers.tsx`
- **AuthProvider**: The React context provider at `src/contexts/auth-context.tsx` that manages authentication state
- **DashboardLayout**: The Next.js Server Component at `src/app/(dashboard)/layout.tsx` that wraps all dashboard routes
- **AgencyDashboard**: The client component at `src/app/(dashboard)/agency/dashboard/page.tsx`
- **Sidebar**: The navigation component at `src/components/sidebar.tsx`
- **StatCard**: The presentational stat display component in `src/app/(dashboard)/restaurant/dashboard/page.tsx`
- **NavContent**: The navigation items sub-component extracted from `Sidebar`
- **SchedulerHeatmap**: The campaign scheduling heatmap component at `src/components/campaigns/scheduler-heatmap.tsx`
- **DeadHourScheduler**: The dead-hour scheduling component at `src/components/campaigns/dead-hour-scheduler.tsx`
- **TwilioNumberPicker**: The phone number selection component at `src/components/agency/twilio-number-picker.tsx`
- **Inter_Font**: The Inter typeface loaded via `next/font/google` in `src/app/layout.tsx`
- **Next.js_Config**: The Next.js configuration file at `frontend/next.config.ts`
- **Build_Process**: The Next.js production build invoked via `npm run build`
- **Image_Component**: The `next/image` component used for rendering optimized images
- **staleTime**: The TanStack Query duration after which cached data is considered stale and eligible for background refetch
- **gcTime**: The TanStack Query duration after which unused cached data is garbage-collected from memory
- **LCP**: Largest Contentful Paint — the time until the largest visible element is rendered
- **TBT**: Total Blocking Time — the total time the main thread is blocked during page load

---

## Requirements

### Requirement 1: Supabase Browser Client Singleton

**User Story:** As a developer, I want the Supabase browser client to be instantiated only once per browser session, so that redundant `GoTrueClient` instances do not compete over the same auth cookie and cause unnecessary re-authentication overhead.

#### Acceptance Criteria

1. THE Supabase_Client_Module SHALL maintain a single SupabaseClient instance for the entire browser session, returning the same reference on every subsequent call to `createClient()`
2. IF `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing at runtime, THEN THE Supabase_Client_Module SHALL throw a descriptive configuration error identifying the missing variable
3. WHEN the page is fully reloaded, THE Supabase_Client_Module SHALL create a new SupabaseClient instance, resetting the singleton for the new session

---

### Requirement 2: TanStack Query Cache Configuration

**User Story:** As a developer, I want TanStack Query cache settings tuned per data type, so that navigating between dashboard sections does not trigger redundant API requests for data that was recently fetched.

#### Acceptance Criteria

1. THE QueryClient SHALL use a default `staleTime` of 2 minutes for all queries that do not specify an override
2. THE QueryClient SHALL use a default `gcTime` of 10 minutes for all queries that do not specify an override
3. THE QueryClient SHALL set `refetchOnWindowFocus` to `false` globally
4. THE QueryClient SHALL set `retry` to `1` globally
5. WHEN `useRestaurantStats` is called, THE Query SHALL use a `staleTime` of 5 minutes
6. WHEN `useRestaurantMessages` is called, THE Query SHALL use a `staleTime` of 30 seconds

---

### Requirement 3: Code Splitting and Lazy Loading

**User Story:** As a user, I want the initial page load to be fast, so that I can start using the dashboard without waiting for JavaScript bundles that are only needed on specific pages.

#### Acceptance Criteria

1. WHEN the campaigns page is loaded, THE Application SHALL load `SchedulerHeatmap` and `DeadHourScheduler` as separate JavaScript chunks via `next/dynamic`
2. WHEN the agency phone-numbers page is loaded, THE Application SHALL load `TwilioNumberPicker` as a separate JavaScript chunk via `next/dynamic`
3. WHILE a lazy-loaded chunk is downloading, THE Application SHALL display a loading indicator in place of the deferred component
4. IF a lazy-loaded chunk fails to download, THEN THE Application SHALL display a user-visible error message instead of an indefinite loading spinner

---

### Requirement 4: React Rendering Optimizations

**User Story:** As a developer, I want stable presentational components to be memoized, so that parent state changes do not cause unnecessary re-renders of components whose props have not changed.

#### Acceptance Criteria

1. THE `StatCard` component SHALL be wrapped with `React.memo` to prevent re-renders when its props are unchanged
2. THE `NavContent` component SHALL be defined at module scope outside the `Sidebar` render function to prevent remounting on `Sidebar` state changes
3. WHEN a memoized child component receives the same props as the previous render, THE Application SHALL not re-render that component
4. WHERE event handler functions are passed as props to memoized child components, THE Application SHALL wrap those handlers with `useCallback` to maintain referential stability

---

### Requirement 5: Next.js Configuration Optimizations

**User Story:** As a developer, I want the Next.js compiler to apply package import optimizations and bundle analysis tooling, so that the production bundle is as small as possible and I can identify regressions.

#### Acceptance Criteria

1. THE Next.js_Config SHALL enable `optimizePackageImports` for `lucide-react` and `@radix-ui/react-icons`
2. THE Next.js_Config SHALL enable `compress` to apply gzip/brotli compression to responses
3. THE Next.js_Config SHALL configure `images.formats` to include `image/avif` and `image/webp`
4. THE Next.js_Config SHALL set `images.minimumCacheTTL` to 604800 seconds (7 days)
5. THE Next.js_Config SHALL configure `images.deviceSizes` to `[640, 750, 828, 1080, 1200]`
6. WHEN the `ANALYZE` environment variable is set to `'true'`, THE Build_Process SHALL generate a bundle analysis report

---

### Requirement 6: Font Loading Optimization

**User Story:** As a user, I want text to be visible immediately when the page loads, so that I can read content without waiting for the Inter font to download.

#### Acceptance Criteria

1. THE Inter_Font SHALL be configured with `display: 'swap'` so that a system fallback font is shown immediately while Inter downloads
2. THE Inter_Font SHALL be configured with `preload: true` to hint the browser to fetch the font early
3. THE Inter_Font SHALL expose a CSS custom property via the `variable` option so that Tailwind can reference the font family

---

### Requirement 7: Auth Context and Dashboard Layout Optimization

**User Story:** As a user, I want the dashboard to render immediately without a full-page loading spinner on every navigation, so that the application feels responsive.

#### Acceptance Criteria

1. THE DashboardLayout SHALL fetch the authenticated user and their profile server-side before rendering the page
2. WHEN `initialUser` and `initialProfile` are provided to `AuthProvider`, THE AuthProvider SHALL initialize `isLoading` to `false` without making additional Supabase auth calls on mount
3. WHEN `initialUser` and `initialProfile` are provided to `AuthProvider`, THE AuthProvider SHALL not issue `supabase.auth.getUser()` or `rpc('get_my_profile')` calls during the initial render
4. WHEN the auth token expires during an active session, THE AuthProvider SHALL refresh the token via the `onAuthStateChange` subscription without requiring a page reload
5. WHEN a user signs out, THE AuthProvider SHALL clear the `user`, `profile`, and `selectedRestaurantId` state

---

### Requirement 8: Image Optimization

**User Story:** As a developer, I want all images to use `next/image` with proper configuration, so that images are automatically served in modern formats with lazy loading and correct sizing.

#### Acceptance Criteria

1. THE Next.js_Config SHALL configure `images` with allowed remote patterns or domains for any external image sources used by the application
2. WHEN an image is rendered without the `priority` prop, THE Image_Component SHALL lazy-load the image by default
3. WHERE an image is the Largest Contentful Paint element on the page, THE Image_Component SHALL be rendered with `priority={true}` to preload it

---

### Requirement 9: API Request Deduplication and Prefetching

**User Story:** As an agency user, I want the agency dashboard to load all its data in a single parallel request, so that I do not experience a sequential waterfall of API calls that delays the dashboard.

#### Acceptance Criteria

1. WHEN the agency dashboard mounts with a known `agencyId`, THE AgencyDashboard SHALL issue a single combined query that fetches restaurants, stats, and transactions in parallel using `Promise.all`
2. THE combined agency dashboard query SHALL use a `staleTime` of 3 minutes
3. WHEN sidebar navigation links are rendered, THE Sidebar SHALL set `prefetch={true}` on `Link` components so that page data begins loading on hover
4. THE Query_Keys used throughout the application SHALL be serializable JSON values containing no functions, class instances, or non-deterministic values such as `Math.random()` or `Date.now()`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Supabase client singleton identity

*For any* number of calls to `createClient()` within the same browser session, every returned value SHALL be strictly reference-equal (`===`) to every other returned value.

**Validates: Requirement 1.1**

---

### Property 2: AuthProvider skips mount fetch when initial data is provided

*For any* valid `User` object and `UserProfile` object passed as `initialUser` and `initialProfile` to `AuthProvider`, the provider SHALL initialize with `isLoading === false` and SHALL NOT invoke `supabase.auth.getUser()` or `rpc('get_my_profile')` during the initial render lifecycle.

**Validates: Requirements 7.2, 7.3**

---

### Property 3: Memoized components do not re-render on stable props

*For any* set of props passed to a `React.memo`-wrapped component, if the same props are passed on a subsequent render, the component's render function SHALL NOT be called again.

**Validates: Requirement 4.3**

---

### Property 4: Query keys are always JSON-serializable

*For any* combination of entity IDs, filter strings, and pagination parameters used to construct TanStack Query keys in the application, calling `JSON.stringify(queryKey)` SHALL NOT throw an error.

**Validates: Requirement 9.4**

---

### Property 5: Images without priority prop are lazy-loaded

*For any* `Image_Component` rendered without the `priority` prop, the rendered `<img>` element SHALL have `loading="lazy"` set.

**Validates: Requirement 8.2**
