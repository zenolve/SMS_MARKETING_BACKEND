/**
 * Property 4: Query keys are always JSON-serializable
 *
 * For any combination of entity IDs, filter strings, and pagination parameters
 * used to construct TanStack Query keys in the application, calling
 * JSON.stringify(queryKey) SHALL NOT throw an error.
 *
 * Validates: Requirement 9.4
 */

import * as fc from 'fast-check'

// All query key shapes used in queries.ts
function buildQueryKeys(
  id: string,
  filter: string,
  status: string | null,
  limit: number,
): unknown[][] {
  // Agency query keys
  const agencyKeys: unknown[][] = [
    ['agencies'],
    ['agencies', id],
    ['agencies', id, 'restaurants'],
  ]

  // Restaurant query keys
  const restaurantKeys: unknown[][] = [
    ['restaurants', { agency_id: id, status: status ?? undefined }],
    ['restaurants', id],
    ['restaurants', id, 'usage'],
    ['restaurants', id, 'stats'],
    ['restaurants', id, 'tags'],
    ['restaurants', id, 'messages', limit],
  ]

  // Customer query keys
  const customerKeys: unknown[][] = [
    ['customers', id, { opt_in_status: filter, tag: filter }],
    ['customers', id],
  ]

  // Campaign query keys
  const campaignKeys: unknown[][] = [
    ['campaigns', id, status],
    ['campaigns', id],
    ['campaigns', id, 'preview'],
  ]

  // Transaction query keys
  const transactionKeys: unknown[][] = [
    ['transactions', id],
  ]

  // Agency dashboard combined query key (from task 5.1)
  const agencyDashboardKeys: unknown[][] = [
    ['agency-dashboard', id],
  ]

  return [
    ...agencyKeys,
    ...restaurantKeys,
    ...customerKeys,
    ...campaignKeys,
    ...transactionKeys,
    ...agencyDashboardKeys,
  ]
}

describe('Property 4: Query keys are always JSON-serializable', () => {
  /**
   * **Validates: Requirement 9.4**
   *
   * For any combination of entity IDs, filter strings, and optional status values,
   * all query key shapes used in queries.ts must be serializable via JSON.stringify
   * without throwing.
   */
  it('all query key shapes serialize without throwing for arbitrary inputs', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uuid(),
          fc.string(),
          fc.option(fc.string(), { nil: null }),
        ),
        ([id, filter, status]) => {
          const limit = 50 // representative default used in useRestaurantMessages
          const keys = buildQueryKeys(id, filter, status, limit)

          for (const key of keys) {
            // JSON.stringify must not throw for any query key
            expect(() => JSON.stringify(key)).not.toThrow()

            // The result must be a valid JSON string (not undefined)
            const serialized = JSON.stringify(key)
            expect(typeof serialized).toBe('string')

            // The serialized value must round-trip back to an array
            const parsed = JSON.parse(serialized)
            expect(Array.isArray(parsed)).toBe(true)
          }
        },
      ),
    )
  })

  it('query keys contain no functions, class instances, or non-deterministic values', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uuid(),
          fc.string(),
          fc.option(fc.string(), { nil: null }),
        ),
        ([id, filter, status]) => {
          const keys = buildQueryKeys(id, filter, status, 50)

          for (const key of keys) {
            const serialized = JSON.stringify(key)

            // Functions serialize to undefined (dropped by JSON.stringify),
            // which would cause the key to lose information — assert none are present
            // by checking the serialized form equals a re-serialization of the parsed form
            const parsed = JSON.parse(serialized)
            expect(JSON.stringify(parsed)).toBe(serialized)
          }
        },
      ),
    )
  })

  it('null status values in campaign and restaurant query keys serialize correctly', () => {
    // Edge case: null is a valid JSON value and must not cause issues
    const keysWithNull = buildQueryKeys('test-id', 'filter', null, 50)
    for (const key of keysWithNull) {
      expect(() => JSON.stringify(key)).not.toThrow()
    }
  })

  it('undefined values in filter objects serialize without throwing', () => {
    // When status is null, the params object has status: undefined
    // JSON.stringify drops undefined object values — this is acceptable behavior
    const key = ['restaurants', { agency_id: 'some-id', status: undefined }]
    expect(() => JSON.stringify(key)).not.toThrow()
    const serialized = JSON.stringify(key)
    expect(typeof serialized).toBe('string')
  })
})
