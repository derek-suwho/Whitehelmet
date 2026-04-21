# PIF QHSE Platform — Group Breakdown

**Project:** Whitehelmet / Salama Reporting Engine for QHSE KPI Submission & Consolidation
**MVP Stack:** Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) + Vue 3 + TypeScript + Pinia
**Reference docs:** `docs/superpowers/plans/2026-04-18-pif-qhse-platform.md`, PS x WHA Product Flow PDF

---

## Group Summaries (Plain Language)

These summaries describe what each group builds in terms of the product flow doc. Use these as your north star when prioritizing tasks — if a feature doesn't serve the user story described here, it's probably out of scope for your group.

---

### Group 1 — "The Submission Pipeline"
*Product Flow: Parts 4 and 5*

Group 1 owns everything that happens between a PM wanting to collect data and that data landing back on the PM's desk — whether or not a template is involved.

In Part 4 of the product flow, the PM clicks a button and each DevCo receives an email with the KPI template attached and a secure, one-time link to submit their completed version. DevCos don't need a login — they download the Excel file, fill it out locally the same way they always have, then upload it through that link. The system receives the file, locks it immediately so it can't be changed after submission, and timestamps it for the audit trail.

Group 1 also supports a **freeform upload flow** for situations where the PM does not have a template ready or wants to collect whatever Excel report a DevCo already produces internally. In this case, the PM generates a plain upload link for a DevCo (no template attached), sends it via email, and the DevCo uploads any `.xlsx` file they choose. The submission is tracked and locked exactly the same way as a template-based submission. The PM can then use Group 2's consolidation AI chatbot to manually map and merge freeform submissions into a master sheet.

In Part 5, the PM's dashboard updates in real time as DevCos submit, showing both template-based and freeform submissions in a unified tracking view. The PM can monitor progress, send reminders, and see at a glance which companies have submitted and which are still pending.

From the PM's perspective, Group 1 turns what used to be an email chain into a managed, trackable workflow — regardless of whether a structured template exists. From the DevCo's perspective, nothing about how they work with Excel changes — they just get a link.

---

### Group 2 — "The Template Engine and Consolidation"
*Product Flow: Parts 3 and 6*

Group 2 owns the two most complex stages of the reporting lifecycle: how templates are created and how submitted data becomes a master sheet.

In Part 3, the PM has two ways to build a KPI template. They can upload an existing Excel file and the system parses it into a structured, versioned Salama-managed form. Or they can open an AI chatbot, describe what they need in plain language ("I need columns for contractor name, monthly incident count, near misses, and total hours worked"), and the system generates the template for them. Either way, the result is a versioned template with structured fields, validation rules, and full history — ready to be distributed to DevCos by Group 1.

In Part 6, once all DevCos have submitted, the PM triggers consolidation. Group 2's engine downloads every locked submission, normalizes the data against the template structure, runs all the PIF-defined formulas (provided by Group 3), and produces a single master KPI spreadsheet covering all DevCos. Freeform submissions are included as raw sheets flagged for manual review. The PM can then use the AI chatbot again to fine-tune the output — reformatting columns, handling edge cases, applying ad-hoc adjustments — before downloading the final file.

Group 2 is the backbone of the platform. It defines the data structures every other group depends on, manages the PIF admin experience end-to-end, and produces the consolidated output that is the entire point of the system.

---

### Group 3 — "The Formula and Skills Library"
*Product Flow: Part 7*

Group 3 owns the reusable intelligence layer that makes the platform more than a file-collection tool.

The product flow describes a library of formulas and skills that PMs can build up over time and apply across any template or consolidation. Group 3 makes that real. A PM can describe a calculation in plain language — "calculate the total recordable incident rate as total incidents divided by total hours worked, multiplied by 200,000" — and the system converts it into both an executable formula and a proper Excel formula string. That formula gets saved to the library, named, and tagged so it can be found and reused in future templates or on different consolidation cycles.

When a formula is attached to a column in Group 2's template builder, Group 3's execution engine is what runs it during consolidation — applying it consistently across every DevCo's submission. Critically, when the master sheet is exported, Group 3 ensures the formulas are embedded as real Excel formula strings inside the file, not as static numbers. This means the downloaded spreadsheet continues to work correctly in Excel or Google Sheets with no dependency on the platform.

Group 3's output is what separates this platform from a simple file merger. It gives PIF a growing library of standardized calculation logic that can be applied consistently across all DevCos, all templates, and all reporting cycles.

---

## How to Read This Document

Each group owns a clearly defined slice of the product. The file ownership tables are strict — if your group is not listed as the owner of a file, you must not create or modify it. Shared interfaces are specified explicitly. When two groups need to communicate (e.g., Group 1 needs to call Group 2's consolidation function), the contract is defined here and must not be changed unilaterally.

---

## Git Conflict Rules (All Groups Must Follow)

### Branch naming
- Each group works on its own long-lived feature branch:
  - Group 1: `feature/group1-submission`
  - Group 2: `feature/group2-templates`
  - Group 3: `feature/group3-formulas`
- Never commit directly to `main`.
- Merge `main` into your branch at the start of each work session: `git pull origin main && git merge main`.

### One file, one owner
- Every file in this repo has exactly one group owner (listed in the file ownership tables below).
- If you need something from a file you don't own, open an issue or message the owning group — do not edit the file yourself.
- Exception: `supabase/migrations/` — each group appends new migration files with sequential timestamps. Never edit another group's migration file.

### Migration file naming
- Migration files must be named `YYYYMMDDHHMMSS_<group>_<description>.sql` to guarantee ordering and avoid collisions.
  - Group 1: `..._g1_...` (e.g., `20260420120000_g1_submissions.sql`)
  - Group 2: `..._g2_...` (e.g., `20260420130000_g2_templates.sql`)
  - Group 3: `..._g3_...` (e.g., `20260420140000_g3_formulas.sql`)
- Never modify a migration that has already been applied to any shared environment.

### Shared files (touch with caution)
The following files are shared across groups. Changes require a PR with sign-off from all affected groups before merging:
- `supabase/config.toml`
- `frontend/src/router/index.ts`
- `frontend/src/stores/auth.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/types/database.ts` (generated types — regenerate with `supabase gen types typescript`, do not hand-edit)

### Committing
- Commits must be scoped to your group's files only. Never stage files outside your ownership table.
- Use conventional commit prefixes: `feat(g1):`, `fix(g2):`, `chore(g3):`, etc.
- Each commit must pass `tsc --noEmit` and `supabase db lint` before pushing.

### PRs and merging
- PRs into `main` require one review from a member of a different group.
- Squash-merge feature branches into `main` to keep history clean.
- After merging to `main`, all other groups must rebase/merge `main` into their branches within 24 hours.

### Supabase Edge Functions
- Each group owns its own Edge Function subdirectory:
  - Group 1: `supabase/functions/g1-*`
  - Group 2: `supabase/functions/g2-*`
  - Group 3: `supabase/functions/g3-*`
- Never create a function in another group's namespace.

### Environment variables
- All new env vars must be added to `.env.example` in the same commit they are introduced.
- Use a group prefix: `G1_`, `G2_`, `G3_` for group-specific vars. Shared vars have no prefix.

---

## Shared Foundation (Prerequisite — Set Up Before Groups Start)

Whoever sets up the foundation should do so before any group begins. All groups depend on this.

### Supabase project setup
- Create Supabase project, copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env.example`
- Enable Email Auth in Supabase dashboard
- Create storage buckets: `templates`, `submissions`, `consolidated`
  - `templates`: public read, authenticated write (pif_admin only via RLS)
  - `submissions`: authenticated read (scoped by org), authenticated write (devco users via token)
  - `consolidated`: authenticated read (pif_admin + owning devco), authenticated write (Edge Function service role only)

### Database schema

```sql
-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('pif', 'devco')),
  parent_org_id uuid references organizations(id),
  created_at timestamptz default now() not null
);

-- profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  role text not null check (role in ('pif_admin', 'devco_admin', 'devco_user')),
  display_name text not null,
  created_at timestamptz default now() not null
);

-- templates
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references profiles(id),
  status text not null default 'draft' check (status in ('draft', 'active', 'deprecated')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- template_versions
create table template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  version_number integer not null,
  schema_json jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now() not null,
  unique (template_id, version_number)
);

-- template_assignments
create table template_assignments (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid references template_versions(id),  -- nullable for freeform assignments
  org_id uuid references organizations(id),
  assigned_by uuid references profiles(id),
  deadline timestamptz,
  submission_type text not null default 'template' check (submission_type in ('template', 'freeform')),
  -- 'template': DevCo receives a template to fill out and return
  -- 'freeform': DevCo uploads any .xlsx file they choose, no template attached
  instructions text,  -- optional PM note shown on the upload page (used primarily for freeform)
  status text not null default 'pending' check (status in ('pending', 'submitted', 'locked')),
  upload_token text unique,
  upload_token_expires_at timestamptz,
  assigned_at timestamptz default now() not null,
  constraint freeform_no_template check (
    submission_type = 'freeform' or template_version_id is not null
  )
);

-- submissions
create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references template_assignments(id),
  org_id uuid references organizations(id),
  file_path text not null,
  file_name text not null,
  status text not null default 'submitted' check (status in ('submitted', 'locked')),
  submitted_at timestamptz default now() not null,
  submitted_by uuid references profiles(id)
);

-- formulas
create table formulas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  nl_prompt text,
  expression text not null,
  formula_type text not null check (formula_type in ('aggregation', 'calculation', 'lookup', 'transformation')),
  is_library_item boolean not null default false,
  created_by uuid references profiles(id),
  usage_count integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- consolidated_sheets
create table consolidated_sheets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id),
  file_path text not null,
  generated_by uuid references profiles(id),
  generated_at timestamptz default now() not null
);
```

### Row Level Security policies (baseline)

```sql
-- profiles: users can only read their own profile; pif_admin reads all
alter table profiles enable row level security;
create policy "profiles_self_read" on profiles for select using (id = auth.uid());
create policy "profiles_pif_read_all" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);

-- organizations: pif_admin sees all; devco users see their own org
alter table organizations enable row level security;
create policy "orgs_pif_all" on organizations for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "orgs_devco_own" on organizations for select using (
  id = (select org_id from profiles where id = auth.uid())
);
```

Each group is responsible for adding RLS policies for its own tables (see per-group sections below).

### Frontend project init
- Vue 3 + TypeScript + Vite + Pinia + Vue Router + TailwindCSS
- `frontend/src/lib/supabase.ts` — single Supabase client instance, imported everywhere
- `frontend/src/types/database.ts` — generated from `supabase gen types typescript --local`
- `frontend/src/stores/auth.ts` — Supabase Auth session, `user`, `profile`, `isAdmin`, `orgType` computed refs

---

## Group 1: Subcontractor/DevCo Submission

**Product flow coverage:** Parts 4 (Template Distribution) and 5 (Submission Tracking)

**One-line goal:** PM sends templates or freeform upload links to DevCos via email; DevCos upload completed Excel files; PM monitors all submission status in real time.

---

### File Ownership — Group 1

**Group 1 owns exclusively. No other group may create or modify these files.**

```
supabase/migrations/*_g1_*.sql
supabase/functions/g1-send-distribution-email/
supabase/functions/g1-send-freeform-link/
supabase/functions/g1-handle-upload/
supabase/functions/g1-send-reminder/

frontend/src/views/submission/
  SubmissionTrackingView.vue        (PM real-time dashboard — template + freeform unified)
  PublicUploadView.vue              (token-based public upload page — handles both modes)
  FreeformUploadManagerView.vue     (PM tool for generating and sending freeform links)
  DevCoTemplateListView.vue         (DevCo assigned templates)
  DevCoSubmissionListView.vue       (DevCo submission history)
  DevCoSubmissionDetailView.vue     (read-only locked submission view)

frontend/src/stores/submissions.ts
frontend/src/components/submission/
  SubmissionStatusMatrix.vue
  SubmissionStatusBadge.vue
  SubmissionTypeBadge.vue           (shows 'Template' or 'Freeform' tag)
  SecureUploadForm.vue
  ReminderButton.vue
  FreeformLinkGenerator.vue         (form for creating a freeform assignment + copying/emailing the link)
```

**Group 1 reads (but does not modify) these files owned by other groups:**
- `frontend/src/types/database.ts` (generated types — shared)
- `frontend/src/lib/supabase.ts` (shared Supabase client)
- `frontend/src/stores/auth.ts` (read `profile.value.role` and `profile.value.org_id`)

**Group 1 adds routes to `frontend/src/router/index.ts` only in this designated block:**
```typescript
// ===== GROUP 1 ROUTES — do not edit outside this block =====
// ===== END GROUP 1 ROUTES =====
```

---

### Database — Group 1

Group 1 owns the RLS policies for `template_assignments` and `submissions`.

```sql
-- template_assignments RLS
alter table template_assignments enable row level security;

-- pif_admin sees all assignments
create policy "assignments_pif_all" on template_assignments for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
-- devco users see assignments for their org
create policy "assignments_devco_own_org" on template_assignments for select using (
  org_id = (select org_id from profiles where id = auth.uid())
);
-- public upload via token (no auth required — validated in Edge Function)
-- token validation happens server-side in g1-handle-upload function, not in RLS

-- submissions RLS
alter table submissions enable row level security;

create policy "submissions_pif_all" on submissions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "submissions_devco_own_org" on submissions for select using (
  org_id = (select org_id from profiles where id = auth.uid())
);
```

---

### Edge Functions — Group 1

#### `g1-send-distribution-email`

**Trigger:** Called by Group 2 (TemplateBuilderView) via a POST request after assignment is created. Group 2 calls this function — Group 1 defines its contract and implements it. Group 2 must not change the contract without Group 1's agreement.

**Input contract:**
```typescript
{
  assignment_id: string     // UUID of template_assignment row
  devco_email: string       // recipient email
  devco_name: string        // DevCo org display name
  template_name: string     // template name for email body
  deadline: string          // ISO date string
}
```

**Behavior:**
1. Generate a signed upload token (UUID) and set `upload_token` + `upload_token_expires_at` on the `template_assignments` row using the service role key.
2. Construct the upload URL: `${SITE_URL}/submit/${token}`
3. Download the template `.xlsx` from Supabase Storage (`templates/` bucket) using `template_version_id` from the assignment row.
4. Send email via Resend API with:
   - Subject: `[Salama] KPI Template Ready — ${template_name}`
   - Body: DevCo name, deadline, instructions
   - Attachment: template `.xlsx` file
   - Secure upload link in body and as a button
5. Return `{ success: true, upload_url: string }`

**Environment variables needed:** `RESEND_API_KEY`, `SITE_URL`

---

#### `g1-send-freeform-link`

**Trigger:** Called from `FreeformUploadManagerView.vue` or Group 2's `AssignmentModal.vue` (freeform mode) when PM generates a freeform upload link for a DevCo.

**Input contract:**
```typescript
{
  org_id: string            // UUID of the DevCo org
  devco_email: string       // recipient email
  devco_name: string        // DevCo org display name
  instructions?: string     // optional PM note shown on the upload page
  deadline?: string         // optional ISO date string
}
```

**Behavior:**
1. Insert a new `template_assignments` row with `submission_type: 'freeform'`, `template_version_id: null`, `org_id`, `instructions`, `deadline`, `status: 'pending'`.
2. Generate a signed upload token and set `upload_token` + `upload_token_expires_at` on the row.
3. Construct the upload URL: `${SITE_URL}/submit/${token}`
4. Send email via Resend API with:
   - Subject: `[Salama] Please Submit Your Report`
   - Body: DevCo name, deadline (if set), PM instructions (if set), and the upload link as a prominent button
   - No template attachment — DevCo brings their own file
5. Return `{ success: true, upload_url: string, assignment_id: string }`

**Key difference from `g1-send-distribution-email`:** No template file is fetched or attached. The upload page will show a plain file input with no download button.

**Environment variables needed:** `RESEND_API_KEY`, `SITE_URL`

---

#### `g1-handle-upload`

**Trigger:** Called client-side from `PublicUploadView.vue` (no auth session required).

**Input contract:**
```typescript
{
  token: string             // upload token from URL
  file: File                // the completed .xlsx file (as FormData)
}
```

**Behavior:**
1. Look up `template_assignments` row by `upload_token` using service role key.
2. Validate: token exists, not expired, assignment status is `pending`.
3. If invalid: return `{ error: 'invalid_token' }` (HTTP 400).
4. Upload file to `submissions/${assignment_id}/${filename}` in Supabase Storage.
5. Insert row into `submissions` table: `assignment_id`, `org_id`, `file_path`, `file_name`, `status: 'submitted'`, `submitted_at: now()`.
6. Update `template_assignments.status` to `locked`.
7. Nullify `upload_token` and `upload_token_expires_at` (one-time use).
8. Return `{ success: true, submission_id: string }`

The GET variant of this function (token validation only, no file) returns the assignment metadata needed by `PublicUploadView` to render the correct mode:
```typescript
{
  valid: boolean
  submission_type: 'template' | 'freeform'
  devco_name: string
  template_name?: string        // only present for template submissions
  template_download_url?: string // signed URL, only present for template submissions
  deadline?: string
  instructions?: string
}
```

---

#### `g1-send-reminder`

**Trigger:** PM clicks "Send Reminder" button in `SubmissionTrackingView` or `FreeformUploadManagerView`.

**Input contract:**
```typescript
{
  assignment_id: string
}
```

**Behavior:**
1. Fetch assignment row — works for both `template` and `freeform` submission types.
2. Validate: status is still `pending`, token is not expired (regenerate if expired).
3. Re-send the appropriate email based on `submission_type`:
   - `template`: re-send via same flow as `g1-send-distribution-email`
   - `freeform`: re-send via same flow as `g1-send-freeform-link`
4. Return `{ success: true }`

---

### Frontend — Group 1

#### `PublicUploadView.vue` (route: `/submit/:token`, no auth required)

This view handles both template-based and freeform upload flows from the same URL. The token validation response tells the page which mode to render.

- On mount: call `g1-handle-upload` GET to validate token and fetch assignment metadata. Show error page if invalid/expired.
- The response includes `submission_type: 'template' | 'freeform'`.

**Template mode** (`submission_type === 'template'`):
- Show: template name, DevCo name, deadline, instructions.
- "Download Template" button: downloads the `.xlsx` from Supabase Storage using a signed URL.
- File input: accepts `.xlsx` only. Show file name and size after selection.
- Helper text: "Please fill out the downloaded template and upload your completed file below."

**Freeform mode** (`submission_type === 'freeform'`):
- Show: DevCo name, deadline (if set), PM instructions (if set).
- No download button — there is no template to download.
- File input: accepts `.xlsx` only. Show file name and size after selection.
- Helper text: "Please upload your completed Excel report below."

**Both modes:**
- "Submit" button: calls `g1-handle-upload` POST with the file. Show progress bar during upload.
- On success: show confirmation screen with submission timestamp. Replace upload form — do not allow re-upload.
- On error: show specific error message. If token expired, show "Contact your PM for a new link."

---

#### `FreeformUploadManagerView.vue` (route: `/admin/freeform-uploads`, pif_admin only)

This is the PM's tool for sending plain upload links to DevCos that don't have a template assigned.

- "New Freeform Request" button opens `FreeformLinkGenerator` inline form:
  - DevCo org selector (dropdown of `organizations` where `type = 'devco'`)
  - Optional instructions text area ("Tell the DevCo what file to upload")
  - Optional deadline date picker
  - "Send Link" button: calls `g1-send-freeform-link`, shows success toast with the upload URL and a "Copy Link" button as a fallback if the PM wants to share it manually
- Table of all existing freeform assignments: DevCo name, sent at, deadline, status badge, actions
- Actions per row: "Send Reminder" (calls `g1-send-reminder`), "View Submission" (if locked)
- Freeform submissions are tracked identically to template submissions — same locking, timestamping, and audit trail

---

#### `SubmissionTrackingView.vue` (route: `/admin/consolidations`, pif_admin only)

- Fetch all `template_assignments` + joined `submissions` and `organizations` on mount.
- Subscribe to Supabase Realtime on `template_assignments` and `submissions` tables for live updates.
- Render a unified matrix table covering both template-based and freeform assignments:
  - Rows: DevCo org names
  - Columns: Type badge (`Template` / `Freeform`), Template name (or "Freeform Upload" if `submission_type = 'freeform'`), Status badge, Submitted at, Actions
- Status badges: `Pending` (yellow), `Submitted` (blue), `Locked` (green)
- Actions per row: "View Submission" (opens read-only preview), "Send Reminder" (calls `g1-send-reminder`, disabled if already locked)
- Summary bar: "X of N DevCos submitted" with a progress bar. Freeform and template submissions are counted together.
- "Consolidate" button: visible when all assignments for a given scope are locked. This button is owned by Group 2 and will be a named slot or emit that Group 2 wires up. Group 1 must expose `@all-submitted` event from this view.
- Note: freeform submissions are included in the tracking view but the PM should be aware that consolidating them requires manual AI-assisted mapping in Group 2's consolidation dashboard, since there is no `schema_json` to normalize against.

---

#### `submissions.ts` (Pinia store)

```typescript
// State
assignments: TemplateAssignment[]       // both template and freeform
submissions: Submission[]
realtimeChannel: RealtimeChannel | null

// Actions
fetchAssignmentsForTemplate(templateVersionId: string): Promise<void>
fetchAllAssignments(): Promise<void>                          // for unified tracking view (all types)
createFreeformAssignment(payload: {                           // called by FreeformLinkGenerator
  orgId: string
  devcoEmail: string
  instructions?: string
  deadline?: string
}): Promise<{ assignmentId: string; uploadUrl: string }>
subscribeToRealtimeUpdates(templateVersionId?: string): void  // omit arg to subscribe to all assignments
unsubscribeFromRealtimeUpdates(): void
sendReminder(assignmentId: string): Promise<void>
getSubmissionSignedUrl(filePath: string): Promise<string>

// Getters
pendingCount: number
submittedCount: number
allSubmitted: boolean
freeformAssignments: TemplateAssignment[]   // filter where submission_type === 'freeform'
templateAssignments: TemplateAssignment[]   // filter where submission_type === 'template'
```

#### `DevCoTemplateListView.vue` (route: `/my-templates`, devco_admin + devco_user)

- Fetch `template_assignments` where `org_id = profile.org_id`.
- Cards per assignment: template name (or "File Submission Request" for freeform), type badge, deadline (highlighted red if past due), status badge.
- "Download Template" button on template-type cards only.
- "View Submission" button if already submitted.

#### `DevCoSubmissionListView.vue` (route: `/my-submissions`, devco_admin + devco_user)

- Fetch `submissions` where `org_id = profile.org_id`, ordered by `submitted_at DESC`.
- Table: type badge, template name or "Freeform", submitted at, status.
- Click row → `DevCoSubmissionDetailView`.

#### `DevCoSubmissionDetailView.vue` (route: `/my-submissions/:id`, devco_admin + devco_user)

- Fetch submission by ID. Validate `org_id` matches user's org.
- Read-only view: show metadata (submitted at, type, template name or "Freeform submission").
- "Download Submitted File" button using Supabase Storage signed URL.
- No edit capability — submissions are locked.

---

### Interface Contract with Group 2

Group 1 exposes one event from `SubmissionTrackingView`:
```typescript
// Emitted when all assignments for the current template version are locked
emit('all-submitted', { templateVersionId: string })
```
Group 2 listens to this event to enable the "Consolidate" button in `ConsolidationDashboardView`. Group 2 must not modify `SubmissionTrackingView` to wire this up — Group 1 will implement the emit; Group 2 renders `SubmissionTrackingView` as a child component and handles the event externally.

---

## Group 2: Master Template Creation + Consolidation

**Product flow coverage:** Parts 3 (Master Template Creation) and 6 (Automatic Consolidation & AI Fine-Tuning)

**One-line goal:** PIF admin creates and versions KPI templates (via upload or AI chatbot), assigns them to DevCos, and consolidates all submissions (including freeform) into a downloadable master KPI sheet.

---

### File Ownership — Group 2

**Group 2 owns exclusively. No other group may create or modify these files.**

```
supabase/migrations/*_g2_*.sql
supabase/functions/g2-parse-template/
supabase/functions/g2-generate-template-ai/
supabase/functions/g2-consolidate/
supabase/functions/g2-finetune-consolidated/

frontend/src/views/admin/
  TemplateListView.vue              (PIF template library)
  TemplateBuilderView.vue           (column editor + formula assignment + publish)
  TemplateDetailView.vue            (version history + assignment management)
  ConsolidationDashboardView.vue    (trigger consolidation + download master)
  OrganizationListView.vue          (manage DevCo orgs)
  UserManagementView.vue            (create users, assign roles/orgs)
  AdminLayout.vue                   (sidebar nav shell for all admin views)

frontend/src/views/admin/modals/
  ImportTemplateModal.vue           (upload + parse + preview)
  AssignmentModal.vue               (select orgs + set deadline + trigger distribution)
  ConsolidationStatusModal.vue      (progress + result download)

frontend/src/stores/templates.ts
frontend/src/stores/admin.ts

frontend/src/components/template/
  ColumnEditor.vue
  ColumnRow.vue
  FieldTypeSelect.vue
  ValidationRuleBuilder.vue
  VersionHistoryTable.vue
  TemplateStatusBadge.vue
  AIChatPanel.vue                   (used for both template creation and consolidation fine-tuning)
```

**Group 2 reads (but does not modify):**
- `frontend/src/types/database.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/stores/auth.ts`
- `frontend/src/stores/submissions.ts` (reads `allSubmitted` getter to enable Consolidate button)
- `frontend/src/components/formula/FormulaLibraryPanel.vue` (Group 3 component — import and use, do not modify)

**Group 2 adds routes to `frontend/src/router/index.ts` only in this designated block:**
```typescript
// ===== GROUP 2 ROUTES — do not edit outside this block =====
// ===== END GROUP 2 ROUTES =====
```

**Group 2 calls these Group 1 Edge Functions (read-only contract — do not modify the functions):**
- `g1-send-distribution-email` — called after creating a `template` type assignment row
- `g1-send-freeform-link` — called after PM selects freeform mode in `AssignmentModal`

---

### Database — Group 2

Group 2 owns the RLS policies for `templates`, `template_versions`, `template_assignments` (write path), `consolidated_sheets`, `organizations`, and `profiles`.

```sql
-- templates RLS
alter table templates enable row level security;
create policy "templates_pif_all" on templates for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "templates_devco_active_read" on templates for select using (
  status = 'active' and
  exists (
    select 1 from template_assignments ta
    join template_versions tv on tv.id = ta.template_version_id
    where tv.template_id = templates.id
      and ta.org_id = (select org_id from profiles where id = auth.uid())
  )
);

-- template_versions RLS
alter table template_versions enable row level security;
create policy "versions_pif_all" on template_versions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
create policy "versions_devco_assigned_read" on template_versions for select using (
  exists (
    select 1 from template_assignments ta
    where ta.template_version_id = template_versions.id
      and ta.org_id = (select org_id from profiles where id = auth.uid())
  )
);

-- consolidated_sheets RLS
alter table consolidated_sheets enable row level security;
create policy "consolidated_pif_all" on consolidated_sheets for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);
```

---

### Edge Functions — Group 2

#### `g2-parse-template`

**Trigger:** Called from `ImportTemplateModal.vue` after PM uploads a `.xlsx`.

**Input contract:**
```typescript
{
  file_path: string         // path in Supabase Storage 'templates' bucket (already uploaded by client)
}
```

**Behavior:**
1. Download file from Storage using service role key.
2. Parse with `exceljs`: extract sheet names, column headers, column types (inferred from first 10 data rows), and sample data (first 3 rows).
3. Return a `TemplateImportPreview` object — no DB writes:
```typescript
{
  sheets: Array<{
    name: string
    columns: Array<{
      name: string
      inferred_type: 'text' | 'number' | 'date' | 'percentage'
      sample_values: string[]
    }>
  }>
}
```

---

#### `g2-generate-template-ai`

**Trigger:** Called from `AIChatPanel.vue` when PM describes the template structure in natural language.

**Input contract:**
```typescript
{
  prompt: string            // PM's natural language description
  existing_schema?: object  // current schema_json if iterating on existing template
}
```

**Behavior:**
1. Call Claude API (`claude-sonnet-4-6`) with a system prompt that instructs it to output a JSON object matching the `schema_json` structure.
2. System prompt specifies: output only valid JSON with keys `columns[]`, each having `name`, `type`, `description`, `validation` (optional).
3. Stream the response back to the client for live preview.
4. Return:
```typescript
{
  schema_json: {
    columns: Array<{
      name: string
      type: 'text' | 'number' | 'date' | 'percentage'
      description: string
      validation?: { required?: boolean, min?: number, max?: number, options?: string[] }
    }>
  }
}
```

---

#### `g2-consolidate`

**Trigger:** Called from `ConsolidationDashboardView.vue` when PM clicks "Consolidate".

**Input contract:**
```typescript
{
  template_id: string
  template_version_id: string
  submission_ids: string[]  // IDs of submissions to include (template + freeform mixed)
}
```

**Behavior:**
1. Validate caller has `pif_admin` role via Supabase JWT.
2. Fetch all submissions by `submission_ids`, validate they are all `locked`.
3. Separate submissions into two buckets by looking up their `template_assignments.submission_type`:
   - `template_submissions`: have a `template_version_id`, can be normalized against `schema_json`
   - `freeform_submissions`: `template_version_id` is null, no schema to normalize against
4. Download each submission `.xlsx` from Storage.
5. **For template submissions:**
   - Fetch `template_versions.schema_json` to know expected columns
   - Parse with `exceljs`, map columns to `schema_json` definitions, extract rows as JSON array
   - Apply Group 3 formulas via `formula-engine.ts`
6. **For freeform submissions:**
   - Parse with `exceljs`, extract all sheets and rows as-is with no normalization
   - Include in the master sheet as raw sheets named `"[OrgName] (Freeform)"`
   - Do not attempt formula execution against freeform sheets — columns are unknown
   - Add a note cell at the top of each freeform sheet: `"Freeform submission — review and map columns manually or use AI fine-tuning"`
7. Build master `.xlsx` using `exceljs`:
   - One sheet per DevCo (named by org name); freeform sheets labeled as above
   - Summary sheet: one row per template-based DevCo with formula-calculated KPI values; freeform DevCos listed with status `"Freeform — manual review required"`
   - Embed formulas as Excel formula strings for template-based columns
8. Upload master file to `consolidated/` bucket.
9. Insert `consolidated_sheets` row.
10. Return `{ consolidated_sheet_id: string, file_path: string, freeform_count: number, template_count: number }`

---

#### `g2-finetune-consolidated`

**Trigger:** Called from `AIChatPanel.vue` on `ConsolidationDashboardView` after a master sheet has been generated.

**Input contract:**
```typescript
{
  consolidated_sheet_id: string
  prompt: string            // PM's natural language adjustment instruction
}
```

**Behavior:**
1. Download the consolidated `.xlsx` from Storage.
2. Parse current state with `exceljs`.
3. Call Claude API with the current sheet structure as context and the PM's instruction.
4. Claude returns a JSON diff of changes: `{ cell_updates: [{sheet, row, col, value}], column_renames: [...], sheet_renames: [...] }`
5. Apply the diff to the workbook.
6. Re-upload as a new version: `consolidated/${id}/v${n}.xlsx`
7. Update `consolidated_sheets.file_path` to point to the new version.
8. Return `{ success: true, new_file_path: string }`

---

### Frontend — Group 2

#### `TemplateListView.vue` (route: `/admin/templates`, pif_admin only)

- Fetch all templates from `templates` table.
- Filter tabs: All | Draft | Active | Deprecated
- Template card: name, status badge, version count, last updated, created by.
- Actions: Edit (→ `TemplateBuilderView`), View History (→ `TemplateDetailView`), Deprecate, Duplicate.
- "New Template" button: opens modal with two options — "Upload Excel" (→ `ImportTemplateModal`) or "Build with AI" (→ `TemplateBuilderView` with AI chat open).

#### `ImportTemplateModal.vue`

- Step 1: Drag-and-drop or file picker (`.xlsx` only). Upload file to `templates/` bucket. Call `g2-parse-template`.
- Step 2: Preview parsed columns in an editable table. PM can rename columns, change inferred types, mark as required.
- Confirm: creates `templates` + `template_versions` rows with the final `schema_json`. Sets status to `draft`.

#### `TemplateBuilderView.vue` (route: `/admin/templates/new` and `/admin/templates/:id/edit`)

Three tabs:

**Columns tab:**
- Table of columns: name (editable), type (dropdown), description (editable), validation rules (expandable inline editor), required toggle.
- Add/remove/reorder rows.
- "Build with AI" toggle: opens `AIChatPanel` in side panel. PM types description, `g2-generate-template-ai` streams back a schema, PM can accept or keep editing.

**Formulas tab:**
- Embeds `FormulaLibraryPanel.vue` (Group 3 component) in a sidebar.
- Table of column names with "Attach Formula" button per row.
- When PM clicks "Attach Formula", the `FormulaLibraryPanel` opens in selection mode. PM selects a formula → it is written into `schema_json.columns[n].formula_id`.
- Formula preview shows what calculation will run during consolidation.

**Assignment tab:**
- Lists current assignments: DevCo org name, type badge, status, deadline.
- "Assign to DevCos" button → opens `AssignmentModal`.
- Existing assignments show: submission status badge (reads from `template_assignments.status`), "Send Reminder" button (calls `g1-send-reminder` — do not re-implement).

**Save / Publish:**
- "Save Draft" — writes to DB, status stays `draft`.
- "Publish" — sets status to `active`, creates a new `template_versions` row (version number incremented).
- If a version is already `active`, publishing creates version N+1 and the previous version remains accessible in history but assignments can only be made against the latest active version.

#### `AssignmentModal.vue`

- Toggle at the top: **"Send with Template"** (default) or **"Freeform Upload"**.

**Send with Template mode** (existing behavior):
- Multi-select list of DevCo orgs.
- Deadline date picker (required).
- "Assign & Send" button: inserts `template_assignments` rows with `submission_type: 'template'`, then calls `g1-send-distribution-email` for each org.

**Freeform Upload mode** (new):
- Single DevCo org selector (one at a time — freeform requests are per-DevCo since instructions may differ).
- Optional instructions text area.
- Optional deadline date picker.
- "Send Freeform Link" button: calls `g1-send-freeform-link` Edge Function. Shows the generated upload URL with a "Copy Link" button so the PM can also share it manually.
- Note displayed to PM: "The DevCo will upload their own Excel file. You can merge freeform submissions into the consolidated sheet using the AI fine-tuning tool."

Both modes show progress and a success toast on completion.

#### `ConsolidationDashboardView.vue` (route: `/admin/consolidations/:templateId`)

- Renders `SubmissionTrackingView` (Group 1 component) as child, passing `templateVersionId` prop.
- Listens to `@all-submitted` event to enable the "Consolidate" button.
- "Consolidate" button (disabled until all assigned DevCos have locked submissions):
  - Opens `ConsolidationStatusModal` with progress indicator.
  - Calls `g2-consolidate` Edge Function.
  - On complete: shows download link for master sheet, and notes how many freeform vs template submissions were included.
- After consolidation, shows `AIChatPanel` for AI fine-tuning (calls `g2-finetune-consolidated`). PM can use this to manually map freeform columns into the normalized structure.
- "Download Master Sheet" button: generates signed URL from `consolidated/` bucket.

#### `templates.ts` (Pinia store)

```typescript
// State
templates: Template[]
currentTemplate: Template | null
currentVersion: TemplateVersion | null
versions: TemplateVersion[]
consolidatedSheets: ConsolidatedSheet[]

// Actions
fetchTemplates(): Promise<void>
fetchTemplate(id: string): Promise<void>
createTemplate(name: string, description: string): Promise<Template>
saveVersion(templateId: string, schemaJson: object): Promise<TemplateVersion>
publishTemplate(templateId: string): Promise<void>
deprecateTemplate(templateId: string): Promise<void>
fetchConsolidatedSheets(templateId: string): Promise<void>
getDownloadUrl(filePath: string): Promise<string>
```

---

### `schema_json` Structure (canonical — all groups must use this format)

```typescript
{
  columns: Array<{
    id: string                // stable UUID for the column — never changes across versions
    name: string
    type: 'text' | 'number' | 'date' | 'percentage'
    description?: string
    formula_id?: string       // UUID from formulas table — Group 3 populates this
    validation?: {
      required?: boolean
      min?: number
      max?: number
      options?: string[]      // for enum/select fields
    }
  }>
}
```

This is the single source of truth for template structure. Group 1 reads it to render the DevCo template download. Group 3 reads `formula_id` per column to know which formula to execute during consolidation. Freeform submissions have no `schema_json` — do not add top-level keys to this object without notifying all groups.

---

## Group 3: Saved Formulas & Skills Library

**Product flow coverage:** Part 7 (Saved Formulas & Skills Library)

**One-line goal:** Build a reusable formula library where PMs create formulas from natural language, apply them to specific cells/columns/ranges in templates or consolidated sheets, and ensure all formulas persist as real Excel formula strings in exported files.

---

### File Ownership — Group 3

**Group 3 owns exclusively. No other group may create or modify these files.**

```
supabase/migrations/*_g3_*.sql
supabase/functions/g3-create-formula-ai/
supabase/functions/g3-execute-formulas/
supabase/functions/_shared/formula-engine.ts    (shared utility — Group 2 imports read-only)

frontend/src/views/formulas/
  FormulaLibraryView.vue            (standalone library management page)

frontend/src/components/formula/
  FormulaLibraryPanel.vue           (sidebar panel — embedded by Group 2)
  FormulaCard.vue
  FormulaBuilderModal.vue
  FormulaApplicationSelector.vue
  FormulaPreview.vue

frontend/src/stores/formulas.ts
```

**Group 3 reads (but does not modify):**
- `frontend/src/types/database.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/stores/auth.ts`

**Group 3 publishes one shared utility** that Group 2 imports read-only:
- `supabase/functions/_shared/formula-engine.ts`

Group 3 adds routes to `frontend/src/router/index.ts` only in this designated block:
```typescript
// ===== GROUP 3 ROUTES — do not edit outside this block =====
// ===== END GROUP 3 ROUTES =====
```

---

### Database — Group 3

Group 3 owns the RLS policies for `formulas`.

```sql
-- formulas RLS
alter table formulas enable row level security;

-- pif_admin can do everything
create policy "formulas_pif_all" on formulas for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pif_admin')
);

-- devco users can read library items only
create policy "formulas_devco_library_read" on formulas for select using (
  is_library_item = true and
  exists (select 1 from profiles p where p.id = auth.uid())
);
```

---

### Shared Utility: `formula-engine.ts`

**This file is owned by Group 3. Group 2 imports it read-only. Group 2 must not modify it.**

```typescript
// supabase/functions/_shared/formula-engine.ts

export interface FormulaContext {
  // All DevCo submission data: keyed by org_id, value is array of row objects
  submissions: Record<string, Record<string, unknown>[]>
  // Column ID → column name mapping from schema_json
  columnMap: Record<string, string>
}

export interface FormulaResult {
  column_id: string
  org_id: string
  value: number | string
  excel_formula: string   // Excel formula string to embed in exported .xlsx
}

// Execute a single formula against submission data for one org
export function executeFormula(expression: string, context: FormulaContext, org_id: string): FormulaResult

// Execute all attached formulas from schema_json for all orgs
export function executeAllFormulas(schemaJson: object, context: FormulaContext): FormulaResult[]

// Convert an internal expression to an Excel formula string
// e.g., "SUM(incident_count)" → "=SUM(C2:C50)" given column mapping
export function toExcelFormula(expression: string, columnMap: Record<string, string>, dataRange: { startRow: number, endRow: number }): string
```

Group 2's `g2-consolidate` function imports from this path:
```typescript
import { executeAllFormulas, toExcelFormula } from '../_shared/formula-engine.ts'
```

Group 3 must maintain backward compatibility with this import — never rename or move `formula-engine.ts`.

---

### Edge Functions — Group 3

#### `g3-create-formula-ai`

**Trigger:** Called from `FormulaBuilderModal.vue` when PM submits a natural language formula description.

**Input contract:**
```typescript
{
  prompt: string                    // natural language description
  schema_json?: object              // current template schema for column context (optional)
  existing_formula_id?: string      // if editing an existing formula
}
```

**Behavior:**
1. Call Claude API with a system prompt that instructs it to output JSON with two fields: `expression` (internal calculation expression) and `excel_formula_template` (Excel formula string with column placeholders).
2. System prompt example guidance:
   - Input: "Calculate incident rate as incidents divided by hours worked multiplied by 200,000"
   - Output: `{ expression: "(incident_count / hours_worked) * 200000", excel_formula_template: "=({incident_count}/{hours_worked})*200000", formula_type: "calculation" }`
3. Validate the expression is safe (whitelist: `+`, `-`, `*`, `/`, `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`, `IF`, `ROUND` — no arbitrary function calls).
4. If `schema_json` is provided, validate that all column references in the expression match actual column names.
5. Return:
```typescript
{
  expression: string
  excel_formula_template: string    // e.g., "=({incidents}/{hours_worked})*200000"
  formula_type: 'aggregation' | 'calculation' | 'lookup' | 'transformation'
  description: string               // Claude's plain-English explanation of what the formula does
  warnings: string[]                // e.g., ["Column 'hours_worked' not found in current template schema"]
}
```

---

#### `g3-execute-formulas`

**Trigger:** Called directly from `g2-consolidate` via the shared `formula-engine.ts` utility (not as an HTTP call). This Edge Function is the standalone callable version for testing or ad-hoc formula execution from the UI.

**Input contract:**
```typescript
{
  formula_ids: string[]             // formula UUIDs to execute
  data: Record<string, unknown>[]   // row data from a submission
  column_map: Record<string, string>// column_id → column_name
}
```

**Behavior:**
1. Fetch formula rows by IDs.
2. Execute each formula against the provided data using `formula-engine.ts` `executeFormula`.
3. Return:
```typescript
{
  results: Array<{
    formula_id: string
    value: number | string
    excel_formula: string
  }>
}
```

---

### Frontend — Group 3

#### `FormulaLibraryPanel.vue` (shared component — imported by Group 2)

This is the primary shared artifact from Group 3. Group 2 embeds it. Group 3 defines its props/emits interface and must not break it.

**Props:**
```typescript
{
  mode: 'browse' | 'select'         // 'browse' = library management, 'select' = pick one for attachment
  filterType?: string               // optional filter by formula_type
  selectedFormulaId?: string        // currently attached formula (highlighted)
}
```

**Emits:**
```typescript
{
  'formula-selected': (formula: Formula) => void   // emitted in 'select' mode when PM picks one
  'formula-created': (formula: Formula) => void    // emitted after saving a new formula
}
```

**Behavior:**
- Fetches all `is_library_item = true` formulas from Supabase.
- Search bar filters by name and description.
- Filter chips for `formula_type`.
- Each `FormulaCard` shows: name, type badge, description, expression preview, usage count.
- "New Formula" button → opens `FormulaBuilderModal`.
- In `select` mode: each card has a "Use This" button that emits `formula-selected`.

#### `FormulaBuilderModal.vue`

- Natural language input field: "Describe what your formula should calculate..."
- "Generate" button: calls `g3-create-formula-ai`. Shows loading state.
- Preview panel (shown after generation):
  - Plain English description of what the formula does
  - Expression string
  - Excel formula string
  - Any warnings
- PM can edit the name, description, and optionally the expression directly.
- "Save to Library" toggle: if on, sets `is_library_item = true`.
- "Save Formula" button: inserts into `formulas` table. Emits `formula-created`.

#### `FormulaLibraryView.vue` (route: `/admin/formulas`, pif_admin only)

- Full-page view of the formula library.
- Renders `FormulaLibraryPanel` in `browse` mode.
- Edit and delete actions per formula (with confirmation dialog for delete).
- Usage count column: shows how many templates use each formula.

#### `FormulaPreview.vue`

- Reusable component for showing a formula's details inline.
- Props: `formula: Formula`, `showExpression?: boolean`
- Used in `FormulaCard` and the Formulas tab in Group 2's `TemplateBuilderView`.

#### `formulas.ts` (Pinia store)

```typescript
// State
libraryFormulas: Formula[]
recentFormulas: Formula[]

// Actions
fetchLibraryFormulas(): Promise<void>
createFormula(payload: FormulaCreate): Promise<Formula>
updateFormula(id: string, payload: Partial<FormulaCreate>): Promise<Formula>
deleteFormula(id: string): Promise<void>
incrementUsageCount(id: string): Promise<void>

// Getters
formulaById: (id: string) => Formula | undefined
formulasByType: (type: string) => Formula[]
```

---

### Formula Persistence in Exports

This is the most critical Group 3 responsibility. When Group 2's `g2-consolidate` builds the master `.xlsx`, it calls `toExcelFormula()` from `formula-engine.ts` to convert internal expressions into Excel formula strings before writing them to cells via `exceljs`.

**Rules for formula expression syntax:**
- Column references must use the exact `name` value from `schema_json.columns[n].name` wrapped in `{}`: e.g., `{incident_count}`, `{hours_worked}`
- Aggregations across all DevCos: use `SUM_ALL({column_name})`, `AVG_ALL({column_name})` — `formula-engine.ts` maps these to the correct Excel cell ranges
- Cross-column arithmetic: standard operators `+`, `-`, `*`, `/`
- No string concatenation, no cell range literals, no sheet references — the engine handles those mappings
- Formulas are never applied to freeform submission sheets — only to template-based columns with known structure

**Export guarantee:** When the master `.xlsx` is opened in Excel or Google Sheets offline, all formula cells must recalculate correctly using the embedded formula strings. `exceljs` writes these as `.value = { formula: '=SUM(C2:C50)' }` — never as static values.

---

## Cross-Group Integration Summary

| Integration Point | Producer | Consumer | Mechanism |
|---|---|---|---|
| Send template distribution email | Group 1 (`g1-send-distribution-email`) | Group 2 (`AssignmentModal.vue`) | HTTP call to Edge Function |
| Send freeform upload link | Group 1 (`g1-send-freeform-link`) | Group 2 (`AssignmentModal.vue` freeform mode) | HTTP call to Edge Function |
| Send reminder | Group 1 (`g1-send-reminder`) | Group 2 (`TemplateBuilderView` Assignment tab) | HTTP call to Edge Function |
| Unified submission status tracking | Group 1 (`SubmissionTrackingView`) | Group 2 (`ConsolidationDashboardView`) | Vue component embed + `@all-submitted` event |
| Freeform submission type flag | Group 1 (`template_assignments.submission_type`) | Group 2 (`g2-consolidate`) | DB column read during consolidation |
| Formula library panel | Group 3 (`FormulaLibraryPanel.vue`) | Group 2 (`TemplateBuilderView` Formulas tab) | Vue component import |
| Formula execution engine | Group 3 (`formula-engine.ts`) | Group 2 (`g2-consolidate`) | TypeScript module import |
| Formula application to columns | Group 3 (writes `formula_id` into `schema_json`) | Group 2 (reads `formula_id` during consolidation) | `schema_json` contract |
| Excel formula embedding | Group 3 (`toExcelFormula()`) | Group 2 (`g2-consolidate`) | TypeScript function import |

Any change to a shared interface must be announced to all consuming groups before merging and requires all groups to update their usage in the same PR window.

---

## Coverage Verification

| Platform MD / Product Flow Requirement | Group |
|---|---|
| Multi-tenant foundation (orgs, roles, RLS) | Shared Foundation |
| Supabase Auth + profiles with roles | Shared Foundation |
| Template upload path (Excel → schema_json) | Group 2 |
| AI-assisted template creation (chatbot) | Group 2 |
| Template version control | Group 2 |
| Template assignment to DevCos | Group 2 |
| Email distribution with secure upload link (template) | Group 1 |
| Freeform upload link — no template, DevCo brings own file | Group 1 |
| Secure public upload page (handles both template + freeform modes) | Group 1 |
| PM freeform upload manager (generate + track freeform links) | Group 1 |
| DevCo portal (assigned templates + submission history) | Group 1 |
| Submission locking + timestamping + audit | Group 1 |
| Real-time submission tracking dashboard | Group 1 |
| Reminder emails for pending submissions | Group 1 |
| Automatic consolidation engine (template + freeform submissions) | Group 2 |
| AI fine-tuning of consolidated output | Group 2 |
| Downloadable master KPI sheet | Group 2 |
| Formula library CRUD | Group 3 |
| Natural language formula creation | Group 3 |
| Formula application to columns/cells/ranges | Group 3 |
| Formula execution against submission data | Group 3 |
| Formula persistence in exported .xlsx | Group 3 |
| Admin: org management | Group 2 |
| Admin: user management | Group 2 |
