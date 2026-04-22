# Screen — Project Home

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`

## Two Major Variants

### A) Project Home — Without Phase (`2710:244615`)

**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2710-244615

### B) Project Home — With Phase (`2710:246760`)

**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2710-246760

---

## Layout

### Left Sidebar (collapsible)

- Project logo + project name at top
- Nav items:
  - **Project Home** (active, highlighted blue)
  - Analytics
  - DMS
  - QHSE
  - Observations
  - Knowledge Hub
  - Asif AI
  - CCM
  - Data Management
- Bottom: User Management | Settings

### Main Area

**Breadcrumb:** Home > [Group Name] > [Project Name] > Project Home

**Page header:** "Project Home" (h1) | Search bar | "+ Create" (Primary button) | kebab menu

**Phase selector:**
- Without Phase: "Phase: Default | In progress" + kebab
- With Phase: "Phase: [dropdown]" (e.g. "Construction") + "In progress" badge + chevron + kebab

**Right of phase:** "Show Cores Only" toggle | Filter icon

---

## Structure Table

Columns: **Zone** | **Core/Plan** | **Name** | (kebab)

### Row Types

| Icon | Type | Description |
|------|------|-------------|
| Purple grid (4-square) | Zone | Area/location within project; up to 3 nesting levels |
| Blue stack (Core) | Core | Main building/structure containing plans and units |
| Orange plan icon | Plan | Plan within a core |

- Rows are collapsible (chevron left of icon)
- Completed items show green checkmark badge after name
- Kebab per row for row-level actions

### Empty State (`2710:253113`)

- Centered illustration + "No Structure Added Yet"
- Subtitle: "Start structuring your project by creating zones or cores."
- "+ Create" button (Primary, centered)
- Toast: "Phase was Created" (bottom-right, green)

---

## "+ Create" Dropdown Menu (`2710:252842`)

Three options (with icons and descriptions):

| Option | Icon | Description |
|--------|------|-------------|
| **Phase** | Phase icon | Time-based stage (Design, Construction...). Can be marked Completed. |
| **Zone** | Grid icon | Area or location. Up to 3 levels (North Zone → Restaurants Zone → Food Court). |
| **Core** | Stack icon | Main building/structure containing plans and units. Can be marked Completed. |

---

## Project Home — Filter State (`2710:255952`)

- Filter panel active (right side or overlay)
- Filter icon highlighted

---

## Kebab Row Actions (`2703:184323` — with open menu)

Context menu options: View Structure | Edit | Move to Group | Clone Project | Archive

---

## Key UI Patterns

- Left sidebar: dark navy (`#1a1a2e`) background, white text, active item has blue pill highlight
- Structure table: tree-like indentation; Zone > Core > Plan hierarchy
- Phase dropdown: allows switching between project phases
- "Show Cores Only" checkbox hides Zone rows, shows only Cores
- Completed state: green circle checkmark icon appended to row name
- Toast notifications appear bottom-right (green = success)
- Phase badge colors: "In progress" = yellow/amber, "Completed" = green
