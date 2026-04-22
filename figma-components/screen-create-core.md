# Screen — Create Core

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `2710:255188`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2710-255188

## Trigger

Opened from the "+ Create" dropdown on Project Home by selecting **Core**.

## Layout

Full-page form (not a modal). Same nav as Project Home.

**Page header:** "< Create Core" (h1 with back arrow)

**Content card:** "Core Details"

### Left Panel — Fields

| Field | Type | Notes |
|-------|------|-------|
| Core Name | Text input | Required (red asterisk) |
| Core Description | Textarea | Optional |
| Select Zone | Dropdown | "Select Zone" — places core under selected zone |

Note below dropdown: "Select a Zone to Add the Core under it."

### Right Panel — Live Preview

Org chart tree showing full hierarchy:
- Organization Level (org logo at top)
- Group Level
- Project Level
- Phase Level: phases shown as labeled pill nodes (e.g. "Infrastructure Completed", "Construction In Progress")
- Zones Level: zone nodes (purple grid icon + name)
- Core Level: core nodes (blue stack icon + name), new core shown as empty placeholder

## Footer

- "Create" (Primary button, right-aligned) — disabled until required fields filled

## Variants

Nodes `2710:255188` through `2710:255431` cover form states.

## Key UI Patterns

- Same two-column layout as Create Group / Create Project
- Live preview shows the new core's position in the full hierarchy
- Phase status badges visible in preview (Completed = green, In Progress = yellow)
- Zone dropdown required to position the core correctly
- Back arrow exits without saving
