# Screen — Home

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `2703:171046`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2703-171046

## Layout

**Nav bar (top, dark):** Logo (WhiteHelmet icon) | Home | Analysis | QHSE | Asif AI — bell icon — avatar — kebab menu

**Page header:** "Home" (h1) | Search bar (center) | "+ Create" button (Primary, right) | kebab menu

**Two sections:**

### Section 1 — Groups
- Section title: "Groups" + subtitle "Groups help you keep related projects together by company, region, or any criteria you choose."
- Right: "View All Groups >" (Outline button)
- Horizontal scrollable row of **Group Cards** (6 visible)

#### Group Card
- Logo image (centered, ~80px)
- Group name (bold)
- "N Projects" (muted)
- Kebab menu (top-right)
- Colored top border (varies per group: green, orange, purple, yellow, red, etc.)

### Section 2 — All Projects
- Section title: "All Projects (241)"
- Right: filter icon
- **Data table** with columns: Logo | Key | Project Name | Project Manager | Group | Last Update | (kebab)

#### Table Row
- Logo: small branded logo or initials badge
- Key: short project key (e.g. SNB, STC, SAP)
- Project Name: full name
- Project Manager: avatar + name (with tooltip showing name on hover)
- Group: group name text
- Last Update: date (DD-MM-YYYY)
- Kebab: row actions

## Variants / States

| Node | Description |
|------|-------------|
| `2703:171046` | Default — with groups + projects |
| `2703:171265` | Org M — No Projects, There are Groups |
| `2703:171384` | Org M — No Projects, No Groups |
| `2703:171466` | Alternative variant |
| `2703:171639` | Org SA/A — No Projects, There are Groups |
| `2703:171708` | Org M variant |

## Key UI Patterns

- Top navbar is dark navy (#1a1a2e approx), always visible
- Page body is white/light grey (#f5f5f5 approx)
- Group cards use colored top border to differentiate groups
- Table rows alternate with subtle separator lines
- Avatar multi (stacked avatars) used when multiple PMs
- Tooltip appears on avatar hover showing full name
- Context Menu appears on kebab click (View Structure | Edit | Clone Project | Archive)
