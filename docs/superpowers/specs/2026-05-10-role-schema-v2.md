# Session Context — Role Schema v2 + Fixes
**Date:** 2026-05-10  
**Branch:** artem  
**Author:** Artem Drohobytsky

---

## Overview

This session delivered two things:

1. **Role Schema v2** — a full redesign of the user role model, replacing the old four-role flat hierarchy with a two-tier system: global admin roles at the top, and project-scoped participant sub-roles below.
2. **Submit Button Fix** — the DevCo "Fill Online" editor had its top bar hidden behind the fixed global navbar; patched with `pt-14`.

---

## 1. Role Schema v2

### Why

The old schema (`org_super_admin | org_admin | org_member | subcontractor`) was flat and global — every user had a single role that applied across all projects. This made it impossible to give someone submission rights on one project but read-only access on another. The new schema fixes this and introduces two distinct admin roles for future permission divergence.

### New Role Model

```
profiles.role                    → 'super_admin' | 'coe_admin' | 'participant'
project_members.participant_role → 'focal' | 'member' | 'viewer'
```

**Global roles (profiles.role):**
| Role | Description |
|---|---|
| `super_admin` | Full admin — manages all projects, templates, users, submissions |
| `coe_admin` | Same permissions as super_admin; stored separately so they can diverge later |
| `participant` | Project-level user; actual access is determined by participant_role per project |

**Project-scoped roles (project_members.participant_role):**
| Role | Can Submit | Can View |
|---|---|---|
| `focal` | Yes | Yes |
| `member` | No | Yes |
| `viewer` | No | Yes (placeholder — same as member for now) |

**Key rules:**
- `super_admin` and `coe_admin` see ALL projects — no `project_members` entry required
- `participant` users see only projects they have a `project_members` row for
- Only `focal` participants can call the submit endpoint (enforced in backend)
- `coe_admin` is a new role — no existing users were migrated to it

### Migration Mapping

| Old role | New profiles.role | participant_role |
|---|---|---|
| `org_super_admin` | `super_admin` | — |
| `org_admin` | `participant` | `focal` (added to all existing projects) |
| `org_member` | `participant` | `member` (added to all existing projects) |
| `subcontractor` | `participant` | `focal` (existing project_members rows updated) |

---

## 2. Database Migration

**File:** `supabase/migrations/20260510000000_role_schema_v2.sql`

Run in Supabase SQL Editor. Runs as a single atomic transaction. Steps:

1. Add `participant_role TEXT` to `project_members` (nullable → fill → NOT NULL + check constraint)
2. Backfill existing `project_members` rows (all former subcontractors) → `focal`
3. Cross-join `org_admin` profiles × all projects → new `project_members` rows as `focal`
4. Cross-join `org_member` profiles × all projects → new `project_members` rows as `member`
5. Drop old `profiles.role` check constraint (dynamic — works regardless of constraint name)
6. Rename role values: `org_super_admin → super_admin`, rest → `participant`
7. Add new check constraint: `role IN ('super_admin', 'coe_admin', 'participant')`
8. Replace `handle_auth_user_sync` trigger — normalizes all legacy + new role strings on signup
9. Update 5 RLS policies (profiles, organizations, templates, template_versions, consolidated_sheets) — admin condition is now `role IN ('super_admin', 'coe_admin')`

**Note:** UUID/varchar type cast fix applied to backfill queries (`p.id::text`, `pr.id::text`) — `projects.id` and `profiles.id` are native `uuid` type while `project_members` foreign keys are `varchar`.

**Verification queries (run after migration):**
```sql
SELECT role, count(*) FROM profiles GROUP BY role;
-- Expected: super_admin | participant only

SELECT participant_role, count(*) FROM project_members GROUP BY participant_role;
-- Expected: focal | member | viewer only
```

---

## 3. Backend Changes

### `backend/app/core/rbac.py` — Full replacement
```python
_ADMIN_ROLES = frozenset({"super_admin", "coe_admin"})
_ALL_ROLES   = frozenset({"super_admin", "coe_admin", "participant"})

def _is_admin(user) -> bool  # used inline in routes

async def require_admin(...)      # replaces require_org_super_admin
async def require_participant(...)  # replaces require_subcontractor

# Legacy aliases kept for zero-churn safety:
require_org_super_admin = require_admin
require_org_admin       = require_admin
require_org_member      = require_participant
require_subcontractor   = require_participant
```

### `backend/app/models/project_member.py`
Added `participant_role = Column(String(20), nullable=False, default="focal")`

### `backend/app/models/profile.py`
Updated comment: `# super_admin | coe_admin | participant`

### `backend/app/schemas/projects.py`
Added `participant_role: str = "focal"` to `AddMemberRequest`

### `backend/app/schemas/subcontractor.py`
Added `participant_role: str | None = None` to `AssignmentForSubcontractor`

### `backend/app/schemas/admin.py`
Added inline comment to `UpdateRoleRequest.role` field documenting valid values

### `backend/app/api/routes/admin.py`
- Import updated to `require_admin`
- All 14 `require_org_super_admin` references replaced with `require_admin`

### `backend/app/api/routes/projects.py`
- Import updated to `require_admin`; all guard references replaced
- `get_project`: member dict now includes `participant_role`
- `add_member`: `ProjectMember` created with `participant_role=body.participant_role`

### `backend/app/api/routes/submissions.py`
- Import updated to `require_admin`; router-level guard updated

### `backend/app/api/routes/subcontractor.py`
- Import updated to `require_participant` + `_is_admin`
- `ProjectMember` added to imports
- Router-level guard: `require_participant`
- `submit_file`: focal check added after assignment lock check — non-admin users must have `participant_role = 'focal'` in the project's `project_members` row or receive 403
- `list_my_assignments`: looks up `project_members` row per assignment and returns `participant_role`

### `backend/app/core/keycloak.py`
Role map updated for future Keycloak integration:
```python
"Super_Admin": "super_admin",
"COE_Admin":   "coe_admin",
"Participant": "participant",
# Legacy mappings retained:
"Org_Super_Admin": "super_admin",
"Org_Admin":       "participant",
"Org_Member":      "participant",
```
Priority list updated: `["super_admin", "coe_admin", "participant"]`

---

## 4. Frontend Changes

### `frontend/src/stores/auth.ts`
```typescript
const isAdmin = computed(() =>
  user.value?.role === 'super_admin' || user.value?.role === 'coe_admin'
)
```

### `frontend/src/router/index.ts`
- `/admin` route meta: `role: 'org_super_admin'` → `requiresAdmin: true`
- All three guard locations in `beforeEach` updated to use `isAdmin` local variable
- `isAdmin` = `['super_admin', 'coe_admin'].includes(auth.user?.role)`

### `frontend/src/components/layout/TopBar.vue`
Both `v-if="auth.user?.role === 'org_super_admin'"` → `v-if="auth.isAdmin"`

### `frontend/src/stores/admin.ts`
- `createUser` role param: `'super_admin' | 'coe_admin' | 'participant'`
- `updateUserRole` role param: same
- `addProjectMember(projectId, userId, participantRole = 'focal')` — sends `participant_role` in POST body

### `frontend/src/views/admin/UserManagementView.vue`
- `roleBadge`: purple → `super_admin`, indigo → `coe_admin`, gray → `participant`
- Default role ref: `'participant'`
- Both dropdowns (table row + invite modal): "Super Admin" / "COE Admin" / "Participant"
- `changeRole` type updated to new role union

### `frontend/src/views/SubcontractorView.vue`
- `Assignment` interface: added `participant_role: 'focal' | 'member' | 'viewer' | null`
- "Fill Online" button: `v-if="a.status !== 'locked' && a.participant_role === 'focal'"`
- Upload section: `v-if="a.status !== 'locked' && a.participant_role === 'focal'"`

### `frontend/src/views/admin/ProjectDetailView.vue`
- Added `memberParticipantRole` ref (default `'focal'`)
- `addMember()` passes `memberParticipantRole.value` to store; resets to `'focal'` on close
- Add Member modal: new "Project Role" select (Focal / Member / Viewer) above error message

### `frontend/src/types/database.ts`
`Profile.role` type updated: `'super_admin' | 'coe_admin' | 'participant'`

---

## 5. Submit Button Fix

**File:** `frontend/src/views/SubcontractorTemplateEditorView.vue`

**Problem:** `TopBar.vue` uses `fixed top-0 left-0 right-0 h-14 z-50`. The fill-online editor view used `h-screen` on the root div with no top offset, so its own top bar (containing the ← back link and Submit button) was rendered directly behind the fixed global navbar and invisible.

**Fix:** Root div class changed from `flex flex-col h-screen` → `flex flex-col h-screen pt-14`

**Also:** "Submit to PIF" label → "Submit" (button + instruction banner)

---

## 6. Deployment Order

Run in this exact sequence to minimize downtime:

1. **Run SQL migration** in Supabase SQL Editor (`supabase/migrations/20260510000000_role_schema_v2.sql`)
   - DB moves to new schema; backend goes briefly to 403 for all users
2. **Deploy backend** — guards read new role values; admins can log in again
3. **Deploy frontend** — role strings, `isAdmin`, dropdowns, and `participant_role` gating live

---

## 7. Verification Checklist

**Database:**
```sql
SELECT role, count(*) FROM profiles GROUP BY role;
-- Only: super_admin | participant

SELECT participant_role, count(*) FROM project_members GROUP BY participant_role;
-- Only: focal | member | viewer
```

**API:**
- `GET /api/auth/me` as super_admin → `role: "super_admin"`
- `GET /api/admin/users` as participant → 403
- `POST /api/projects/{id}/members` with `{"user_id": "...", "participant_role": "member"}` → 201
- `GET /api/projects/{id}` → members include `participant_role` field
- `POST /api/subcontractor/assignments/{id}/submit` as member → 403
- `POST /api/subcontractor/assignments/{id}/submit` as focal → 201

**Frontend:**
- `super_admin` login → redirected to `/admin/dashboard`, Admin nav visible
- `participant` login → redirected to `/submissions`, no Admin nav
- User Management dropdowns: "Super Admin" / "COE Admin" / "Participant"
- Add Member modal on project detail: shows Focal/Member/Viewer selector
- Assignment card: "Fill Online" visible for focal, hidden for member/viewer
- Fill Online editor: Submit button visible (not hidden behind navbar)

---

## 8. Files Changed This Session

| File | Type | Change |
|---|---|---|
| `supabase/migrations/20260510000000_role_schema_v2.sql` | New | Full DB migration |
| `backend/app/core/rbac.py` | Modified | New guard functions |
| `backend/app/core/keycloak.py` | Modified | Updated role map |
| `backend/app/models/project_member.py` | Modified | `participant_role` column |
| `backend/app/models/profile.py` | Modified | Updated comment |
| `backend/app/schemas/projects.py` | Modified | `participant_role` in AddMemberRequest |
| `backend/app/schemas/subcontractor.py` | Modified | `participant_role` in AssignmentForSubcontractor |
| `backend/app/schemas/admin.py` | Modified | Role comment |
| `backend/app/api/routes/admin.py` | Modified | Guard updated |
| `backend/app/api/routes/projects.py` | Modified | Guard + participant_role in add/get |
| `backend/app/api/routes/submissions.py` | New | Submission admin routes (review, download, file update, KPI report) |
| `backend/app/api/routes/subcontractor.py` | Modified | Guard + focal check + participant_role in list |
| `backend/app/services/kpi_report.py` | New | KPI report generation service |
| `backend/app/models/submission.py` | Modified | Review fields |
| `backend/app/models/template_version.py` | Modified | file_path column |
| `backend/migrations/versions/` | New (7 files) | Alembic migration versions |
| `frontend/src/stores/auth.ts` | Modified | `isAdmin` covers both admin roles |
| `frontend/src/stores/admin.ts` | Modified | Role types + participant_role |
| `frontend/src/router/index.ts` | Modified | `requiresAdmin` meta + updated guards |
| `frontend/src/types/database.ts` | Modified | Profile.role union type |
| `frontend/src/components/layout/TopBar.vue` | Modified | `auth.isAdmin` |
| `frontend/src/views/admin/UserManagementView.vue` | Modified | New role labels + badges |
| `frontend/src/views/SubcontractorView.vue` | Modified | participant_role gating |
| `frontend/src/views/admin/ProjectDetailView.vue` | Modified | participant_role selector + upload template |
| `frontend/src/views/admin/MasterSheetEditorView.vue` | Modified | Auth header fix |
| `frontend/src/views/SubcontractorTemplateEditorView.vue` | New | Fill-online editor + submit button fix |
| `frontend/src/views/admin/SubmissionReviewView.vue` | New | Admin submission review UI |
| `frontend/src/composables/useSpreadsheetEditor.ts` | Modified | Cell value + color fixes |
| `frontend/src/App.vue` | Modified | Minor layout |
| `frontend/src/views/LoginView.vue` | Modified | Auth flow |
| `frontend/src/types/index.ts` | Modified | Type updates |
| `frontend/src/views/admin/MasterSheetEditorView.vue` | Modified | Auth header fix |
| `backend/migrations/env.py` | Modified | Alembic env config |
| `backend/app/main.py` | Modified | Route registration |
| `backend/app/schemas/formula.py` | Modified | Formula schema updates |
| `backend/app/models/formula.py` | Modified | Formula model |
| `backend/app/api/routes/formulas.py` | Modified | Formula routes |
| `backend/app/api/routes/templates.py` | Modified | Upload xlsx endpoint |
