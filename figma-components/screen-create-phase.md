# Screen — Create Phase (Modal)

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node (modal — empty):** `2710:253225`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2710-253225

## Trigger

Opened from the "+ Create" dropdown on Project Home by selecting **Phase**.

## Modal Layout

- **Title:** "Create Phase"
- **Close button:** × (top-right)
- **Divider**

### Fields

| Field | Type | Notes |
|-------|------|-------|
| Phase Name | Text input | Placeholder: "Enter Phase Name" |

### Footer

- "Cancel" (Ghost/text button)
- "Create Phase" (Primary button — disabled when empty, enabled when name entered)

## States

| Node | State |
|------|-------|
| `2710:253225` | Empty (Create Phase disabled) |
| `2710:253532` | Filled (Create Phase enabled) |

## Post-Creation

After phase created, modal closes and:
- Project Home reloads showing the new phase in the phase selector
- Toast notification: "Phase was Created" (green, bottom-right)
- Empty state shown if no structure yet (`2710:253113`)

## Key UI Patterns

- Simple single-field modal, centered overlay
- Dark scrim behind modal
- CTA disabled until field has content
- Minimal friction — one field, one action
