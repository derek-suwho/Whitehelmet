# Shared Design System — Tokens & Patterns

Extracted from visual inspection of all Figma screens and the Foundations file.

## Colors

### Brand

| Token | Approx Hex | Usage |
|-------|-----------|-------|
| Primary / Brand Purple | `#3B2ECC` or `#4A3AE8` | Primary buttons, active nav items, links, stepper active |
| Primary Button Fill | `#4338CA` approx | Primary button background |
| Nav Dark | `#0F0E2A` / `#1a1a2e` | Top navbar background, left sidebar background |
| Logo Yellow-Green | `#C8D400` approx | Logo icon primary color |
| Logo Grey | `#8A8A8A` approx | Logo icon secondary/accent |

### Status / Semantic

| Token | Approx Hex | Usage |
|-------|-----------|-------|
| In Progress (badge) | `#F59E0B` / amber | Phase status badge |
| Completed (badge) | `#10B981` / green | Phase/Core completed badge |
| Destructive | `#EF4444` / red | Destructive buttons, error states |
| Success | `#10B981` / green | Success buttons, success toasts |

### Neutrals

| Token | Approx Hex | Usage |
|-------|-----------|-------|
| Page Background | `#F8F9FA` | Main content area |
| Card / Surface | `#FFFFFF` | Cards, table rows, modals |
| Border | `#E5E7EB` | Table dividers, card borders, input borders |
| Muted Text | `#6B7280` | Subtitles, metadata, secondary text |
| Body Text | `#111827` | Primary text |
| Nav Text | `#FFFFFF` | Text on dark navbar |

### Group Colors (card top borders)

Groups use one of: Blue, Purple, Green (teal), Red/Orange, Yellow/Amber, Cyan, Pink — set during group creation.

## Typography

| Role | Weight | Size (approx) |
|------|--------|--------------|
| H1 (page title) | Bold (700) | 28–32px |
| H2 (section title) | SemiBold (600) | 20–22px |
| Body | Regular (400) | 14–15px |
| Small / Meta | Regular (400) | 12–13px |
| Button label | Medium (500) | 14px |
| Nav item | Medium (500) | 14px |

Font family: clean sans-serif (appears to be Inter or similar)

## Spacing

- Base unit: 8px
- Card padding: 16–24px
- Table row height: ~48–56px
- Section gap: 24–32px
- Page horizontal padding: 24–32px

## Radius

| Element | Radius |
|---------|--------|
| Buttons | pill (~20px) |
| Cards | 8–12px |
| Inputs | 6–8px |
| Modals | 12–16px |
| Badge pills | pill |

## Navigation

### Top Navbar (all roles)
- Dark navy background
- Logo (WhiteHelmet Icon, dark=true variant) — left
- Nav links — center-left
- Bell icon, Avatar, Kebab — right
- Height: ~56px

### Project User Nav Links
Home | Analysis | QHSE | Asif AI

### Org Admin Nav Links
Home | Analytics | Org Library | Admin Center

### Left Sidebar (project context)
- Width: ~200px
- Dark navy background (matches top navbar)
- Project logo + name at top
- Vertical nav items with icon + label
- Active item: blue pill/highlight
- Bottom: User Management + Settings

## Common Components

### Breadcrumb
`Home > [Group] > [Project] > [Page]`
- Muted text links, `>` separator
- Current page bold or same weight

### Data Table
- Column headers: muted, sortable (chevron up/down)
- Row hover: light grey highlight
- Row separator: thin border `#E5E7EB`
- Action column: kebab menu (right-aligned)

### Group Card
- White background, 8–12px radius
- Colored top border (4px, group color)
- Logo centered (max ~80px)
- Name + "N Projects" below
- Kebab top-right

### Avatar / Avatar Multi
- Circle, colored background with initials (2 chars)
- Stacked when multiple: overlap by ~8px
- Tooltip on hover: full name

### Status Badge / Pill
- Rounded pill shape
- In Progress: amber bg, dark text
- Completed: green bg, white/dark text

### Toast Notification
- Bottom-right of viewport
- Green for success ("Phase was Created")
- Icon (checkmark) + message
- Auto-dismiss

### File Drop Zone
- Dashed border rectangle
- Upload icon (arrow up)
- "Click to upload or drag and drop" (link-styled CTA)
- Accepted formats note below

### Stepper
- Numbered circles: active = filled blue, completed = checkmark blue, inactive = grey outline
- Connecting line between steps
- Step labels below circles

### Live Preview (Org Chart)
- Light grey background panel
- Tree diagram: circles (logo/initials) connected by curved lines
- Level labels on left: Organization Level / Group Level / Project Level / Phase Level / Zones Level / Core Level
- New item shown as placeholder circle

### Context Menu (Kebab)
- White card, subtle shadow
- Items: icon + label (+ optional description for destructive)
- Divider between groups of actions
- Hover: light grey highlight
