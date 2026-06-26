---
name: tdd-coverage
description: >
  Activate when the user asks to write tests, improve test coverage, add a test suite,
  fix a failing test, or when implementing a new feature or bug fix that requires
  a Red-Green-Refactor cycle. Also activate when the user mentions jest, React Native
  testing, mock isolation, or any TDD-related term.
---

# TDD Coverage Skill

This skill encodes the team's mandatory testing methodology for the Talebound
project (React Native + Expo client and Node.js backend). It must be applied in
full on every task that involves tests. For backend guardrail logic it pairs with
the `backend-guardrail` skill (test-first is mandatory there, see doc section 13).

---

## 0. Alignment with RLM Methodology

This skill follows the same Staged Execution used by the Bennet Agent (RLM):

| RLM Phase     | TDD Mapping                                              |
|---------------|----------------------------------------------------------|
| Map           | Read the component under test. Identify states, props, side effects. |
| Chunk         | Write ONE failing test (Red). Make it pass (Green). One at a time.   |
| Aggregate     | Refactor only after all tests in the describe block are green.       |

Never write the implementation before the test exists. Never write multiple tests
at once without running the suite in between.

---

## 1. Red-Green-Refactor Cycle (Non-Negotiable)

1. **Red**: Write a failing test that defines the expected behaviour.
2. **Green**: Write the minimum code to make it pass. No gold-plating.
3. **Refactor**: Clean up with the safety net of a green suite.

If the user asks to implement a feature without mentioning tests, ask:
"Should I start with the failing test (Red phase) as per the TDD guidelines?"

---

## 2. File & Folder Layout

```
ComponentName/
  index.tsx
  __tests__/
    index.test.tsx        # component-level tests
    hooks.test.ts         # custom hook tests (if any)
    utils.test.ts         # pure utility tests (if any)
  __tests__/mocks/        # shared mocks (only when used by 2+ test files)
```

---

## 3. Mock State — Isolation Rules

See full pattern in [mock-isolation.md](./examples/mock-isolation.md).

Key rules:
- Declare shared mock variables with `let` inside `describe`, never `const` at module level.
- Reset all mocks in `beforeEach`, not once at module level.
- `jest.mock()` is hoisted before imports — use `require()` inside the factory for
  any variable that would be out of scope.

```typescript
// CORRECT
describe('MyComponent', () => {
  let mockUser: User;

  beforeEach(() => {
    mockUser = createMockUser(); // fresh object every test
  });
});

// WRONG — risks cross-test mutation
const mockUser = createMockUser();
```

---

## 4. Dual-State Validation

Every feature with authentication-gated behaviour needs both states covered:

```typescript
describe('Anonymous state', () => { /* ... */ });
describe('Logged-in state', () => { /* ... */ });
```

This is mandatory, not optional.

---

## 5. Child Component Presence — testID Mock Pattern

When `index.test.tsx` must verify whether a child component is mounted, mock the
child and use a stable `testID` that lives only in the test file.

```typescript
jest.mock('../ChildComponent', () => {
  const { View } = require('react-native');
  return () => <View testID="child-component-mock" />;
});

// Verify mounted
expect(getByTestId('child-component-mock')).toBeTruthy();

// Verify NOT mounted
expect(queryByTestId('child-component-mock')).toBeNull();

// Mutually exclusive children — verify BOTH in the same test
expect(getByTestId('empty-state-mock')).toBeTruthy();
expect(queryByTestId('list-state-mock')).toBeNull();
```

Never call `getByTestId` on an element internal to an unmocked child.

---

## 6. Boundary & Error Testing

Always cover critical limits and error paths explicitly:

```typescript
it('disables the CTA when the active coupon limit (20) is reached', () => { /* ... */ });
it('handles 401 from the backend gracefully', () => { /* ... */ });
it('handles 404 from the backend gracefully', () => { /* ... */ });
it('handles 503 from the backend gracefully', () => { /* ... */ });
```

---

## 7. Console Silencing for Error-Path Tests

When a test intentionally triggers `console.error` or `console.warn`, silence the
console to keep the output clean:

```typescript
import { silenceConsole, restoreConsole } from '../../../utils/mockUtils';

beforeAll(() => silenceConsole({ error: true, warn: true, log: false }));
afterAll(() => restoreConsole());
```

---

## 8. Structure: Separators & JSDoc

Every `describe` must be preceded by a `=====` separator. Every `it()` must have
a JSDoc comment explaining **why** the test exists, not just what it does.

See a complete annotated example in [annotated-test.md](./examples/annotated-test.md).

```typescript
// =============================================================
// SECTION: Activation CTA
// =============================================================
describe('Activation CTA', () => {

  /**
   * Ensures authenticated users can reach the CTA without friction.
   * Regression guard for the login-gate introduced in RQM-XXXX.
   */
  it('renders the activation button when the user is logged in', () => {
    // ...
  });
});
```

---

## 9. Global vs Local Mocks

Before adding a `jest.mock()` to a test file, check `__mocks__/jest.setup.js`.
If the module is already mocked globally, extend the global mock — do not re-declare it locally.

---

## 10. YAGNI — Mock Extraction Rule

Do **not** move `jest.mock()` declarations to a shared file until they are used by
a second test file.

When a second consumer appears:
1. Add a comment in the original file:
   `// TODO: extract mocks to __tests__/mocks/<feature>/<file>.ts`
2. Extract at merge time, not before.

---

## 11. RLM Execution Plan Template

When the user asks to write tests for a component, propose this plan before writing
any code:

```
Plan — TDD Coverage for <ComponentName>

Phase 1 (Map):
  - [ ] Read component props, state, side effects
  - [ ] Identify test scenarios (anonymous, logged-in, error states)
  - [ ] List required mocks

Phase 2 (Chunk — one test at a time):
  - [ ] describe: Anonymous state
  - [ ] describe: Logged-in state
  - [ ] describe: Boundary conditions
  - [ ] describe: Error paths (401, 404, 503)

Phase 3 (Aggregate):
  - [ ] Run full suite
  - [ ] Refactor only after all green
```

Always ask: "Shall I proceed with Phase 1?" before writing any code.
