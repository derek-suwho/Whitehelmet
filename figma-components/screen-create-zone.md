# Screen — Create Zone (Modal)

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `2710:254141`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2710-254141

## Trigger

Opened from the "+ Create" dropdown on Project Home by selecting **Zone**.

## Modal Layout

- **Title:** "Create Zone"
- **Close button:** × (top-right)

### Fields

| Field | Type | Notes |
|-------|------|-------|
| Zone Name | Text input | Placeholder: "Enter Zone Name" |

**Context note below input:** "It will be created under: [Parent Zone Name]" (shown in bold when nested)

### Footer

- "Cancel" (Ghost button)
- "Create Zone" (Primary — disabled when empty)

## Hierarchy Rules

- Zones can be nested up to 3 levels deep (e.g. North Zone → Restaurants Zone → Food Court)
- Modal shows parent context when creating a sub-zone

## Key UI Patterns

- Same pattern as Create Phase modal — single field, minimal friction
- Parent context shown to avoid confusion about where zone will be created
- CTA disabled until name entered
- Dark scrim behind modal
