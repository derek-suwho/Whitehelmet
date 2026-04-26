# Screen — Org Home (Admin/SA Role)

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `7360:266468`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=7360-266468

## Key Difference from Home

This view uses a **different top navbar** indicating an Org-level (Super Admin / Admin) role:

**Nav bar:** Logo | **Home** | **Analytics** | **Org Library** | **Admin Center** | bell | avatar | ?

Compare to project-user navbar: Home | Analysis | QHSE | Asif AI

## Layout

Same structure as the regular Home screen:

- "Home" page header with Search + "+ Create" + kebab
- **Groups** section (horizontal card row + "View All Groups >")
- **All Projects** table

## Modals Available from This View

### Move Projects to This Group (`7360:266468` — modal open)

- **Title:** "Move Projects to This Group"
- **Subtitle:** "Select projects currently under the organization to assign them to this group"
- **Left:** "Select Projects" multi-select dropdown
  - Search by Name or Key input
  - List of org-level projects with "Select" action
- **Right:** Live Preview org chart
  - Shows org → groups → selected projects connecting into the group
- **Footer:** "Cancel" + "Move Projects" (Primary — disabled until selection)

### Move Project to Group (`7360:266845` — modal open)

- **Title:** "Move Project to Group"
- **Subtitle:** "Select the group you want to move this project to"
- **Project Name:** displayed (e.g. "Saudi National Bank")
- **Select Group:** dropdown with search + hierarchical list (Group / Subgroup radio selection)
- **Right:** Live Preview org chart showing proposed new placement
- **Footer:** "Cancel" + "Move Project" (Primary)

## Key UI Patterns

- Admin nav gives access to Org Library and Admin Center (not visible to regular project users)
- Move modals have same two-column form + live-preview layout
- Org chart in preview shows full hierarchy with the new position highlighted
- Radio buttons used for single-group selection in Move Project modal
- Search field in dropdown for large group lists
