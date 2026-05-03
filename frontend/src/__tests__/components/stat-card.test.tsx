/**
 * @jest-environment jsdom
 *
 * Property test for memoized component re-render behavior
 *
 * Property 3: Memoized components do not re-render on stable props
 *
 * For any set of props passed to a React.memo-wrapped component, if the same
 * props are passed on a subsequent render, the component's render function
 * SHALL NOT be called again.
 *
 * Validates: Requirement 4.3
 */

import React, { useRef } from 'react'
import { render } from '@testing-library/react'
import fc from 'fast-check'

// ---------------------------------------------------------------------------
// MemoTestCard — mirrors the StatCard React.memo pattern from
// frontend/src/app/(dashboard)/restaurant/dashboard/page.tsx
//
// StatCard is not exported from the page file, so we create a standalone
// component here that uses the same React.memo wrapping pattern.
// A render counter ref is used to track how many times the inner function runs.
// ---------------------------------------------------------------------------

interface MemoTestCardProps {
  title: string
  value: string
  change?: string | null
}

// Shared render counter — incremented each time the inner render function runs.
// We use a module-level counter (reset per test) rather than a ref because
// refs are per-instance and we need to observe across re-renders of the same tree.
let renderCount = 0

const MemoTestCard = React.memo(function MemoTestCard({ title, value, change }: MemoTestCardProps) {
  renderCount++
  return (
    <div>
      <span data-testid="title">{title}</span>
      <span data-testid="value">{value}</span>
      {change != null && <span data-testid="change">{change}</span>}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Helper: a parent component that re-renders when its own state changes,
// passing the same props to MemoTestCard each time.
// ---------------------------------------------------------------------------

interface ParentProps {
  cardProps: MemoTestCardProps
  triggerCount: number
}

function Parent({ cardProps, triggerCount }: ParentProps) {
  // triggerCount is used to force the parent to re-render without changing cardProps
  return (
    <div data-trigger={triggerCount}>
      <MemoTestCard {...cardProps} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Property 3: Memoized components do not re-render on stable props', () => {
  beforeEach(() => {
    renderCount = 0
  })

  /**
   * **Validates: Requirement 4.3**
   *
   * For any arbitrary set of props (title, value, optional change), rendering
   * a React.memo-wrapped component twice with identical props must result in
   * the inner render function being called exactly once — not twice.
   *
   * The second render is triggered by re-rendering the parent with a new
   * `triggerCount` prop (which changes the parent's output) while keeping
   * the card props identical. React.memo should bail out of re-rendering
   * MemoTestCard because its props are shallowly equal.
   */
  it('inner render function is called exactly once when same props are passed on re-render', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string(),
          value: fc.string(),
          change: fc.option(fc.string(), { nil: null }),
        }),
        (props) => {
          renderCount = 0

          const { rerender, unmount } = render(
            <Parent cardProps={props} triggerCount={1} />
          )

          // After initial render, the inner function should have been called once
          expect(renderCount).toBe(1)

          // Re-render the parent with a new triggerCount but SAME cardProps
          // React.memo should prevent MemoTestCard from re-rendering
          rerender(
            <Parent cardProps={props} triggerCount={2} />
          )

          // The inner render function must still be at 1 — not called again
          expect(renderCount).toBe(1)

          unmount()
        },
      ),
      { numRuns: 50 },
    )
  })

  /**
   * Verify the inverse: when props DO change, the component re-renders.
   * This confirms the render counter is working correctly and that
   * React.memo is not suppressing renders it should allow.
   */
  it('inner render function IS called again when props change', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string(),
          value: fc.string(),
          change: fc.option(fc.string(), { nil: null }),
        }),
        fc.record({
          title: fc.string(),
          value: fc.string(),
          change: fc.option(fc.string(), { nil: null }),
        }),
        (propsA, propsB) => {
          // Only run the assertion when the two prop sets are actually different
          // (fast-check may occasionally generate identical records)
          const isDifferent =
            propsA.title !== propsB.title ||
            propsA.value !== propsB.value ||
            propsA.change !== propsB.change

          if (!isDifferent) return // skip identical pairs

          renderCount = 0

          const { rerender, unmount } = render(
            <Parent cardProps={propsA} triggerCount={1} />
          )

          expect(renderCount).toBe(1)

          // Re-render with different props — React.memo must allow the re-render
          rerender(
            <Parent cardProps={propsB} triggerCount={1} />
          )

          expect(renderCount).toBe(2)

          unmount()
        },
      ),
      { numRuns: 50 },
    )
  })

  /**
   * Concrete example: verify the property holds for a specific known prop set.
   * This makes the test output easier to understand when debugging.
   */
  it('does not re-render on stable props (concrete example)', () => {
    renderCount = 0

    const props: MemoTestCardProps = {
      title: 'Total Customers',
      value: '1,234',
      change: '567 opted in',
    }

    const { rerender } = render(<Parent cardProps={props} triggerCount={1} />)
    expect(renderCount).toBe(1)

    // Re-render parent multiple times with same card props
    rerender(<Parent cardProps={props} triggerCount={2} />)
    rerender(<Parent cardProps={props} triggerCount={3} />)
    rerender(<Parent cardProps={props} triggerCount={4} />)

    // MemoTestCard should still have rendered only once
    expect(renderCount).toBe(1)
  })

  /**
   * Concrete example: verify re-render occurs when title changes.
   */
  it('re-renders when title prop changes (concrete example)', () => {
    renderCount = 0

    const { rerender } = render(
      <Parent cardProps={{ title: 'Before', value: '0', change: null }} triggerCount={1} />
    )
    expect(renderCount).toBe(1)

    rerender(
      <Parent cardProps={{ title: 'After', value: '0', change: null }} triggerCount={1} />
    )
    expect(renderCount).toBe(2)
  })

  /**
   * Verify that null and undefined change props are treated as stable.
   * React.memo uses Object.is for shallow comparison, so null === null.
   */
  it('treats null change prop as stable across re-renders', () => {
    renderCount = 0

    const props: MemoTestCardProps = { title: 'Test', value: '42', change: null }

    const { rerender } = render(<Parent cardProps={props} triggerCount={1} />)
    expect(renderCount).toBe(1)

    rerender(<Parent cardProps={props} triggerCount={2} />)
    expect(renderCount).toBe(1)
  })
})
