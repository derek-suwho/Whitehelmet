# Screen — Group (Detail)

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `2703:174231`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2703-174231

## Layout

**Nav bar (top, dark):** Same as Home.

**Breadcrumb:** Home > [Group Name]

**Page header:**
- Back arrow `<`
- Group logo (avatar/initials badge, colored per group) + **Group Name (N)** (h1)
- Group description text (subtitle, below heading)
- Tabs: **Projects** (active) | Analytics
- Right: "+ Create Project" (Primary button) | kebab menu

**Body:** Data table of projects in this group

### Projects Table

Columns: Logo | Key | Project Name | Project Manager | Last Update | (kebab)

- Logo: branded project logo or initials badge
- Key: short code
- Project Name: full name
- Project Manager: avatar + name (tooltip on hover showing full name)
- Last Update: date
- Kebab: row-level actions

## States / Variants

| Node | Description |
|------|-------------|
| `2703:174231` | Group with 6 projects |
| `2703:174389` | Group variant |
| `2703:174522` | Group variant |
| `2703:174658` | Group variant |
| `2703:184164` | Group variant |

## Key UI Patterns

- Group avatar/logo appears in page header alongside name
- "GN" initials badge (purple circle) shown when no logo
- Tabs switch between Projects list and Analytics view
- Table same structure as Home "All Projects" table, minus the Group column
- Tooltip on PM avatar shows full name
- Kebab on row: project-level actions
