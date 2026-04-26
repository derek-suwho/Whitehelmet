# Figma Design Context — Index

All design context extracted from the three Whitehelmet Figma files. Use these files as reference before implementing any frontend screen or component.

---

## Figma Files

| File | Key | URL |
|------|-----|-----|
| Foundations | `P8qktMjwmbYPuHOwlMobfz` | https://www.figma.com/design/P8qktMjwmbYPuHOwlMobfz/Foundations |
| Web Components | `NsRL0OMxo3bzbdGXdNJOcQ` | https://www.figma.com/design/NsRL0OMxo3bzbdGXdNJOcQ/Web-Components |
| Project Structure: Screens | `tNdnPVIddkKCcL8HykfyMD` | https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens- |

---

## Components (Foundations & Web Components)

| File | Description |
|------|-------------|
| `foundations-logo.md` | WhiteHelmet logo — all variants (Logo, Logo+Slogan, Icon, Name, Name+Slogan) × (Dark=False/True). Node `136:1400`. |
| `components-button.md` | Button component — 10 types × 4 sizes × 8 states = 203 variants. Node `149:990`. |
| `shared-design-system.md` | Extracted design tokens: colors, typography, spacing, radius, and all shared UI patterns (navbar, table, cards, badges, toasts, etc.). |

---

## Screens (Project Structure)

All screens live in file key `tNdnPVIddkKCcL8HykfyMD`, canvas `1:603`.

| File | Screen | Key Nodes |
|------|--------|-----------|
| `screen-home.md` | **Home** — default landing with Groups section + All Projects table | `2703:171046` |
| `screen-all-groups.md` | **All Groups** — grid view of all org groups | `2703:174103` |
| `screen-group.md` | **Group Detail** — projects table within a group + Analytics tab | `2703:174231` |
| `screen-create-group.md` | **Create Group** — 2-step wizard (Group Details + Select Projects) | `2703:175021` |
| `screen-create-project.md` | **Create Project** — 4-step wizard (Main Details, Advanced Details, Data Management, User Management) | `2710:241224` |
| `screen-project-home.md` | **Project Home** — structure table (Phase / Zone / Core / Plan hierarchy), left sidebar nav | `2710:244615` (no phase), `2710:246760` (with phase) |
| `screen-project-home-filter.md` | **Project Home (Filter)** — filter panel active on structure table | `2710:255952` |
| `screen-create-phase.md` | **Create Phase** — simple modal, single Phase Name field | `2710:253225` |
| `screen-create-zone.md` | **Create Zone** — modal, single Zone Name field + parent context | `2710:254141` |
| `screen-create-core.md` | **Create Core** — full-page form (Core Name, Description, Select Zone + live org chart preview) | `2710:255188` |
| `screen-org-home.md` | **Org Home (Admin role)** — same as Home but with Org Library + Admin Center nav; includes Move Project modals | `7360:266468` |

---

## Screen Hierarchy / User Flow

```
Home
├── View All Groups → All Groups → Group Detail
│   └── + Create Project → Create Project (4 steps)
├── All Projects table → (row click) → Project Home
│   ├── + Create → Phase (modal) / Zone (modal) / Core (full page)
│   └── Filter → Project Home (filter state)
└── (Admin only) → Org Home (different navbar)
    ├── Move Projects to Group (modal)
    └── Move Project to Group (modal)
```

---

## Role Differences

| Role | Top Navbar | Access |
|------|-----------|--------|
| Project User | Home \| Analysis \| QHSE \| Asif AI | Projects, Groups, QHSE |
| Org Admin / SA | Home \| Analytics \| Org Library \| Admin Center | + org-level management, move projects |

---

## How to Use

1. Find the screen you need to implement in the table above
2. Open the corresponding `.md` file for layout, field specs, and UI pattern details
3. Check `shared-design-system.md` for all tokens (colors, spacing, radius, typography)
4. Check `foundations-logo.md` for the correct logo variant to use
5. Check `components-button.md` for the correct button type/size/state
6. If you need to fetch live Figma data, use `mcp__plugin_figma_figma__get_screenshot` or `get_metadata` with the fileKey + nodeId listed in each file
