# Mock Isolation Patterns

Reference file for `tdd-coverage` skill.
These patterns prevent the most common cross-test contamination bugs.

---

## Pattern 1 — let at describe level, reset in beforeEach

```typescript
describe('CouponCard', () => {
  let mockCoupon: Coupon;
  let mockOnActivate: jest.Mock;

  beforeEach(() => {
    mockCoupon = {
      id: 'coupon-1',
      title: 'Test Coupon',
      isActive: false,
      expiresAt: new Date('2099-01-01'),
    };
    mockOnActivate = jest.fn();
  });

  it('calls onActivate with the coupon id on press', () => {
    const { getByTestId } = render(
      <CouponCard coupon={mockCoupon} onActivate={mockOnActivate} />,
    );
    fireEvent.press(getByTestId('coupon-card-cta'));
    expect(mockOnActivate).toHaveBeenCalledWith('coupon-1');
  });

  it('does NOT call onActivate when the coupon is already active', () => {
    mockCoupon.isActive = true; // safe mutation — fresh object each test
    const { getByTestId } = render(
      <CouponCard coupon={mockCoupon} onActivate={mockOnActivate} />,
    );
    fireEvent.press(getByTestId('coupon-card-cta'));
    expect(mockOnActivate).not.toHaveBeenCalled();
  });
});
```

---

## Pattern 2 — jest.mock() with require() inside the factory

Use this whenever the factory needs React, React Native primitives, or any other
module that would be out of scope at hoist time.

```typescript
jest.mock('../../components/SaviGallery', () => {
  const { View } = require('react-native');
  return {
    SaviGallery: ({ testID }: { testID?: string }) => (
      <View testID={testID ?? 'savi-gallery-mock'} />
    ),
  };
});

jest.mock('../../hooks/useSaviProvider', () => ({
  useSaviProvider: () => ({
    coupons: [],
    isLoading: false,
    error: null,
    activate: jest.fn(),
  }),
}));
```

---

## Pattern 3 — Nested beforeEach for multi-scenario setup

Avoids creating extra objects outside the describe tree.

```typescript
describe('SaviScreen', () => {
  let mockUseSaviProvider: jest.SpyInstance;

  beforeEach(() => {
    mockUseSaviProvider = jest.spyOn(SaviProvider, 'useSaviProvider');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================
  // SECTION: Loading state
  // =========================================================
  describe('when data is loading', () => {
    beforeEach(() => {
      mockUseSaviProvider.mockReturnValue({
        coupons: [],
        isLoading: true,
        error: null,
        activate: jest.fn(),
      });
    });

    /**
     * Prevents the user from seeing a broken empty state
     * while the API call is still in flight.
     */
    it('renders the skeleton placeholder', () => {
      const { getByTestId } = render(<SaviScreen />);
      expect(getByTestId('savi-skeleton-mock')).toBeTruthy();
      expect(queryByTestId('savi-list-mock')).toBeNull();
    });
  });

  // =========================================================
  // SECTION: Error state
  // =========================================================
  describe('when the provider returns a 503', () => {
    beforeEach(() => {
      mockUseSaviProvider.mockReturnValue({
        coupons: [],
        isLoading: false,
        error: { status: 503, message: 'Service unavailable' },
        activate: jest.fn(),
      });
    });

    /**
     * Guards against a silent white screen when the backend is down.
     * Requirement from ticket RQM-XXXX.
     */
    it('renders the error banner instead of the list', () => {
      const { getByTestId } = render(<SaviScreen />);
      expect(getByTestId('savi-error-banner-mock')).toBeTruthy();
      expect(queryByTestId('savi-list-mock')).toBeNull();
    });
  });
});
```

---

## Pattern 4 — Checking global mocks before adding local ones

Before writing a new `jest.mock()`, run:

```bash
grep -r "jest.mock('../../<module-path>')" __mocks__/jest.setup.js
```

If found, the module is already mocked globally. Extend it with
`jest.spyOn` or `mockReturnValueOnce` inside the test, do not re-declare
the `jest.mock()`.
