# Annotated Test File — Full Example

Reference file for `tdd-coverage` skill.
This is what a compliant test file looks like end to end.

---

```typescript
/**
 * @file SaviScreen/__tests__/index.test.tsx
 *
 * Tests for the SaviScreen entry point component.
 * Covers: child mounting, anonymous/logged-in states, boundary conditions,
 * and backend error resilience.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { silenceConsole, restoreConsole } from '../../../utils/mockUtils';

// =============================================================
// MOCKS
// Child components are mocked with stable test-only testIDs.
// The testID lives here and nowhere else — do not export it.
// =============================================================

jest.mock('../components/SaviList', () => {
  const { View } = require('react-native');
  return () => <View testID="savi-list-mock" />;
});

jest.mock('../components/SaviEmptyState', () => {
  const { View } = require('react-native');
  return () => <View testID="savi-empty-state-mock" />;
});

jest.mock('../components/SaviSkeleton', () => {
  const { View } = require('react-native');
  return () => <View testID="savi-skeleton-mock" />;
});

jest.mock('../components/SaviErrorBanner', () => {
  const { View } = require('react-native');
  return () => <View testID="savi-error-banner-mock" />;
});

jest.mock('../hooks/useSaviProvider');
import { useSaviProvider } from '../hooks/useSaviProvider';

// =============================================================
// HELPERS
// =============================================================

const mockBase = {
  isLoading: false,
  error: null,
  activate: jest.fn(),
};

const withCoupons = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `coupon-${i}`,
    title: `Coupon ${i}`,
    isActive: false,
  }));

// =============================================================
// SUITE
// =============================================================

describe('SaviScreen', () => {
  let mockActivate: jest.Mock;

  beforeAll(() => silenceConsole({ error: true, warn: true, log: false }));
  afterAll(() => restoreConsole());

  beforeEach(() => {
    mockActivate = jest.fn();
    (useSaviProvider as jest.Mock).mockReturnValue({
      ...mockBase,
      coupons: [],
      activate: mockActivate,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================
  // SECTION: Loading state
  // ===========================================================
  describe('Loading state', () => {
    beforeEach(() => {
      (useSaviProvider as jest.Mock).mockReturnValue({
        ...mockBase,
        coupons: [],
        isLoading: true,
      });
    });

    /**
     * The skeleton must replace the list while the API call is in flight.
     * Prevents users from seeing an empty state that looks like "no coupons".
     */
    it('renders the skeleton and hides the list', () => {
      const { getByTestId, queryByTestId } = render(<SaviScreen />);
      expect(getByTestId('savi-skeleton-mock')).toBeTruthy();
      expect(queryByTestId('savi-list-mock')).toBeNull();
    });
  });

  // ===========================================================
  // SECTION: Anonymous state
  // ===========================================================
  describe('Anonymous state', () => {
    beforeEach(() => {
      (useSaviProvider as jest.Mock).mockReturnValue({
        ...mockBase,
        coupons: withCoupons(3),
        isAuthenticated: false,
      });
    });

    /**
     * Unauthenticated users can browse coupons but cannot activate them.
     * The CTA must redirect to login, not trigger the activate flow.
     */
    it('renders the list but disables the activation CTA', () => {
      const { getByTestId } = render(<SaviScreen />);
      expect(getByTestId('savi-list-mock')).toBeTruthy();
      // CTA is present but disabled
      const cta = getByTestId('savi-cta');
      expect(cta.props.accessibilityState?.disabled).toBe(true);
    });
  });

  // ===========================================================
  // SECTION: Logged-in state
  // ===========================================================
  describe('Logged-in state', () => {
    beforeEach(() => {
      (useSaviProvider as jest.Mock).mockReturnValue({
        ...mockBase,
        coupons: withCoupons(3),
        isAuthenticated: true,
        activate: mockActivate,
      });
    });

    /**
     * Authenticated users with fewer than 20 active coupons must be able
     * to activate. Core happy path for the Savi feature.
     */
    it('calls activate when the CTA is pressed', () => {
      const { getByTestId } = render(<SaviScreen />);
      fireEvent.press(getByTestId('savi-cta'));
      expect(mockActivate).toHaveBeenCalledTimes(1);
    });

    // =========================================================
    // SECTION: Boundary conditions
    // =========================================================
    describe('Boundary: active coupon limit', () => {
      /**
       * The CTA must disable at exactly 20 active coupons.
       * This is a hard business rule — exceeding the limit causes a 400
       * from the backend, so we must prevent the call client-side.
       */
      it('disables the CTA when the user has 20 active coupons', () => {
        (useSaviProvider as jest.Mock).mockReturnValue({
          ...mockBase,
          coupons: withCoupons(20).map(c => ({ ...c, isActive: true })),
          isAuthenticated: true,
          activate: mockActivate,
        });
        const { getByTestId } = render(<SaviScreen />);
        const cta = getByTestId('savi-cta');
        expect(cta.props.accessibilityState?.disabled).toBe(true);
      });

      /**
       * At 19 active coupons the CTA must still be enabled.
       * Ensures we are not off-by-one on the boundary check.
       */
      it('keeps the CTA enabled when the user has 19 active coupons', () => {
        (useSaviProvider as jest.Mock).mockReturnValue({
          ...mockBase,
          coupons: withCoupons(19).map(c => ({ ...c, isActive: true })),
          isAuthenticated: true,
          activate: mockActivate,
        });
        const { getByTestId } = render(<SaviScreen />);
        const cta = getByTestId('savi-cta');
        expect(cta.props.accessibilityState?.disabled).toBe(false);
      });
    });
  });

  // ===========================================================
  // SECTION: Empty state
  // ===========================================================
  describe('Empty state (no coupons)', () => {
    /**
     * When the API returns an empty array, the list must be replaced
     * by the empty state component — never show a blank screen.
     */
    it('renders the empty state and hides the list', () => {
      const { getByTestId, queryByTestId } = render(<SaviScreen />);
      expect(getByTestId('savi-empty-state-mock')).toBeTruthy();
      expect(queryByTestId('savi-list-mock')).toBeNull();
    });
  });

  // ===========================================================
  // SECTION: Error resilience
  // ===========================================================
  describe('Error resilience', () => {
    const errorCases = [
      { status: 401, label: 'unauthorized' },
      { status: 404, label: 'not found' },
      { status: 503, label: 'service unavailable' },
    ];

    errorCases.forEach(({ status, label }) => {
      /**
       * Each HTTP error status must surface the error banner and hide
       * the list. The SaviProvider must never leave the UI in a broken state.
       */
      it(`shows the error banner on ${status} (${label})`, () => {
        (useSaviProvider as jest.Mock).mockReturnValue({
          ...mockBase,
          coupons: [],
          error: { status, message: label },
        });
        const { getByTestId, queryByTestId } = render(<SaviScreen />);
        expect(getByTestId('savi-error-banner-mock')).toBeTruthy();
        expect(queryByTestId('savi-list-mock')).toBeNull();
      });
    });
  });
});
```
