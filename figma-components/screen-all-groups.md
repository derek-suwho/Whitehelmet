# Screen — All Groups

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `2703:174103`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2703-174103

## Layout

**Nav bar (top, dark):** Same as Home screen.

**Breadcrumb:** Home > All Groups

**Page header:** "< All Groups (9)" (h1, with back arrow) | "+ Create Group" (Primary button, right)

**Subtitle:** "Groups help you keep related projects together by company, region, or any criteria you choose."

**Body:** CSS grid of **Group Cards** (3 columns, wrapping)

### Group Card (All Groups view)
- Colored top border (group color)
- Logo image (centered, ~80px square)
- Group name (bold, below logo)
- "N Projects" (muted text)
- Kebab menu (top-right corner)

## States / Variants

| Node | Description |
|------|-------------|
| `2703:174103` | 9 groups, populated |
| `2703:174140` | Alternate grouping |
| `2703:174177` | Alternate grouping |

## Key UI Patterns

- Grid cards are equal-width, ~3-up on standard viewport
- First card may show placeholder "GN" initials when no logo uploaded
- Card colors cycle: blue, orange/red, green/teal, yellow, purple, etc.
- Back arrow `<` navigates to Home
- "+ Create Group" leads to Create Group - Step 1
