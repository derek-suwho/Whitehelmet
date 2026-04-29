# UX Redesign — Progress

## Goal
Reorganize navigation and routing so each role lands on the correct page after login.
Individual feature pages are already built — this is a navigation/landing-page reorganization.

## Role-Based Landing Pages (target state)
| Role | Lands on |
|------|----------|
| `pif_admin` | `/admin/dashboard` (new overview page) |
| `devco_admin` | `/submissions` |
| `devco_user` | `/submissions` |
| `subcontractor` | `/submissions` |

## Phase 1 — Router & Guards (`frontend/src/router/index.ts`)
- [x] Add `/admin/dashboard` child route
- [x] Add empty-path `/admin` → `admin-dashboard` redirect
- [x] Fix `beforeEach`: pif_admin → `admin-dashboard`, devco/* → `submissions`
- [x] Add `dashboard` to interception list (LoginView pushes to `dashboard` post-login)
- [x] Fix unauthorized guard: `workspace` → `submissions`

## Phase 2 — AdminLayout (`frontend/src/views/admin/AdminLayout.vue`)
- [x] Rename "Salama Admin" → "Whitehelmet" (line 28)
- [x] Add "Overview" as first nav link → `/admin/dashboard`
- [x] Rename "Freeform Uploads" → "File Uploads"
- [x] Fix Consolidate Files always-active RouterLink bug (`exact-active-class`)

## Phase 3 — Admin Overview Dashboard (new file)
- [x] Create `frontend/src/views/admin/AdminOverviewDashboardView.vue`
- [x] Stat cards: Active Templates, Draft Templates, Projects, Users
- [x] Quick action cards: Create Template, Track Submissions, Upload Files, Formula Library
- [x] Recent Templates table (last 6, click → edit)
- [x] Loading skeleton state

## Phase 4 — SubcontractorView TopBar (`frontend/src/views/SubcontractorView.vue`)
- [x] Import `TopBar` from `@/components/layout/TopBar.vue`
- [x] Prepend `<TopBar />` to template (page already has `pt-14` for the offset)

## Verification
- [ ] pif_admin login → lands on `/admin/dashboard`
- [ ] devco_user login → lands on `/submissions`
- [ ] `/admin` (bare) → redirects to `/admin/dashboard`
- [ ] devco_user navigates to `/admin/templates` → redirected to `/submissions`
- [ ] Admin sidebar header reads "Whitehelmet", "Overview" is first link
- [ ] Overview page: stat cards load, quick actions navigate correctly, recent templates clickable
- [ ] SubcontractorView has branded TopBar with logout

## Notes
- `frontend/src/views/LoginView.vue` calls `router.push({ name: 'dashboard' })` post-login.
  Do NOT change LoginView — instead intercept `to.name === 'dashboard'` in `beforeEach` guard.
- Pending Submissions stat on overview: no aggregate API endpoint exists yet.
  Render Active + Draft template counts instead as proxies.
- The "Consolidate Files" link (`/`) in AdminLayout always shows as active due to Vue Router v4
  prefix matching. Fix with `exact-active-class` on that RouterLink.
