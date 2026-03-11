# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Single-Page Application (SPA) with static HTML UI and minimal backend infrastructure

**Key Characteristics:**
- Client-side only application—all logic runs in the browser
- No persistent backend API (dev server only serves static files)
- Monolithic HTML entry point with embedded styles and client-side scripts
- Three-panel UI pattern: Sources (left), Excel Editor (center), AI Chat (right)
- Mock AI responses with placeholder implementation

## Layers

**Presentation Layer:**
- Purpose: Render the complete UI and handle user interactions
- Location: `index.html` (entire UI in single file)
- Contains: HTML markup, Tailwind CSS configuration, inline styles, client-side JavaScript
- Depends on: Browser DOM APIs, browser storage APIs
- Used by: Users via browser

**Development/Build Layer:**
- Purpose: Support local development and testing workflows
- Location: `serve.mjs`, `screenshot.mjs`
- Contains: HTTP server for development, Puppeteer screenshot automation
- Depends on: Node.js http module, Puppeteer library, fs/path modules
- Used by: Developers running `node serve.mjs` or `node screenshot.mjs`

## Data Flow

**User Upload Flow:**

1. User drags .xlsx file into Sources panel drop zone (or clicks to browse)
2. Drop zone accepts file (UI structure present but handler not fully implemented)
3. File would be loaded and displayed in Excel Editor panel (center)
4. Sheet tabs dynamically updated based on file contents

**Chat Flow:**

1. User types message in chat input box
2. User presses Enter or clicks send button
3. Message appears as user bubble in chat history
4. Mock AI response appears after 500ms delay as AI bubble
5. Chat history auto-scrolls to show latest message
6. Input box clears and refocuses for next message

**State Management:**
- Minimal state management—purely DOM-based with no external state manager
- Chat history persists only during session (DOM elements, not stored)
- No file persistence—uploaded files only exist in browser memory
- Input field state managed through direct DOM manipulation

## Key Abstractions

**Panel Component:**
- Purpose: Reusable UI container with consistent styling and layout structure
- Examples: `.panel-sources`, `.panel-excel`, `.panel-chat`
- Pattern: CSS-based composition with standardized header, body, and footer structure
- Shared styles: panel, panel-header, panel-body, empty-state

**Chat Bubble System:**
- Purpose: Display messages in conversation thread
- Examples: `.chat-bubble-user` (amber background, user messages), `.chat-bubble-ai` (darker background, AI responses)
- Pattern: Dynamic DOM element creation via JavaScript; self-closing bubbles with distinct styling
- Styling: Max width 82% of container, auto text wrapping, rounded corners with asymmetric radius

**Excel Editor Container:**
- Purpose: Serve as placeholder for spreadsheet editing functionality
- Examples: `.excel-grid-area`, `.excel-sheet-tabs`, `.excel-toolbar`
- Pattern: Grid-based layout with toolbar, sheet tabs, and main grid area
- Current state: Fully styled structure, no actual spreadsheet rendering (ready for integration)

**Empty State Pattern:**
- Purpose: Communicate expected user actions when no data loaded
- Examples: Drop zone in Sources panel, grid placeholder in Excel Editor
- Pattern: Centered flex container with icon, label, and hint text
- Used for: Initial state guidance and visual feedback

## Entry Points

**Web Entry Point:**
- Location: `index.html` (root file)
- Triggers: Browser loads `http://localhost:3000/`
- Responsibilities:
  - Render complete 3-panel UI layout
  - Initialize Tailwind CSS theme
  - Set up event listeners for chat interface
  - Provide static structure for future file upload handler

**Development Server Entry Point:**
- Location: `serve.mjs`
- Triggers: Developer runs `node serve.mjs`
- Responsibilities:
  - Start HTTP server on port 3000
  - Serve static files with correct MIME types
  - Route root requests to `index.html`
  - Handle 404 and 500 errors

**Screenshot/Testing Entry Point:**
- Location: `screenshot.mjs`
- Triggers: Developer runs `node screenshot.mjs <url> [label]`
- Responsibilities:
  - Launch headless browser via Puppeteer
  - Navigate to specified URL
  - Capture viewport screenshot (1280x800)
  - Save to `temporary screenshots/` directory with auto-increment filename

## Error Handling

**Strategy:** Minimal error handling—development-focused with basic HTTP error responses

**Patterns:**
- File server responds with 404 for missing files, 500 for other errors
- Try-catch not used in client scripts (relies on browser error defaults)
- User input validation limited to text length checks in textarea (via CSS max-height)
- Screenshot capture uses Puppeteer's built-in timeout (30s) for page load

## Cross-Cutting Concerns

**Logging:** No structured logging—development server logs startup message to console

**Validation:**
- File type validation intended (.xlsx/.xlsm accepted in UI copy) but not enforced in handler
- Text input minimal—no character limit enforcement, only CSS-constrained resize

**Authentication:** Not applicable—no backend or user accounts

**Styling Approach:**
- Tailwind CSS via CDN for base utilities
- Custom Tailwind color extensions for construction-themed palette (concrete, steel, amber safety)
- Inline CSS for layout-critical rules (flexbox, grid, sizing)
- CSS-in-HTML avoids build step requirement

---

*Architecture analysis: 2026-03-10*
