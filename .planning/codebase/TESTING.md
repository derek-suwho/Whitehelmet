# Testing Patterns

**Analysis Date:** 2026-03-17

## Test Framework

**Runner:**
- None. No test framework is installed or configured.
- `package.json` scripts: `"test": "echo \"Error: no test specified\" && exit 1"`
- No `jest.config.*`, `vitest.config.*`, `mocha.*`, or any test runner config detected.

**Assertion Library:**
- None.

**Run Commands:**
```bash
npm test   # Exits with error: "no test specified"
```

## Test File Organization

**Location:**
- No test files exist in the repository.
- No `*.test.*` or `*.spec.*` files detected.
- No `__tests__/` or `tests/` directories.

**Naming:**
- No established naming pattern (no tests exist to establish one).

## Test Structure

No test suite exists. The codebase has zero automated test coverage.

## Mocking

**Framework:** None.

No mocking infrastructure exists.

## Fixtures and Factories

**Test Data:**
- No fixtures, factories, or test data files exist.

**Location:**
- Not applicable.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# Not available — no test runner configured
```

## Test Types

**Unit Tests:** Not present.

**Integration Tests:** Not present.

**E2E Tests:**
- `screenshot.mjs` uses Puppeteer (devDependency) for taking screenshots of the running app, but this is not an automated test — it produces screenshot files, not pass/fail assertions.
- Puppeteer is the only testing-adjacent tool in the project.

## Manual Testing Approach

The project relies entirely on manual browser testing:

1. Start local server: `node serve.mjs` (serves at `http://localhost:3000`)
2. Open browser and interact with the three-panel UI manually
3. Upload `.xlsx` files, trigger consolidation, inspect chat responses

## Guidance for Group 1

Since no test framework exists and none is expected to be added (the project has no build step and no test infrastructure), manual verification is the expected approach:

1. Test `state.chatCommandHandler` by typing commands in the chat panel in a running browser
2. Verify spreadsheet mutations via visual inspection of the Jspreadsheet grid
3. Confirm `state.addMessage` posts correctly to the chat history panel
4. Test the `return true` / `return false` routing by sending both spreadsheet commands and non-spreadsheet messages

If automated tests are desired, Puppeteer is already installed and could be extended from `screenshot.mjs` to make assertions against the DOM.

---

*Testing analysis: 2026-03-17*
