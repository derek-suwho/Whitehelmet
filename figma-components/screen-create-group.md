# Screen — Create Group

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node:** `2703:175021`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2703-175021

## Stepper

2-step wizard:
1. **Group Details** (active)
2. Select Projects

## Layout

**Nav bar (top, dark):** Same as Home.

**Page header:** "< Create Group" (h1 with back arrow)

**Stepper bar:** Step 1 "Group Details" (active/blue dot + label) — connector line — Step 2 "Select Projects" (inactive)

**Content card:** "Group Details"

### Left Panel — Fill Metadata

| Field | Type | Notes |
|-------|------|-------|
| Group Name | Text input | Required (red asterisk) |
| Group Description | Textarea | Optional |
| Upload Group Logo | File drop zone | SVG, PNG, or JPG (Max Size: 1MB) |
| Select Group Color | Color picker | Blue (default), Purple, Green, Red, Cyan, Pink |

### Right Panel — Live Preview

- Org chart diagram showing hierarchy: Organization Level node → Group Level nodes → selected group highlighted
- Updates live as user fills form

## Footer

- "Next" button (Primary, right-aligned) — advances to Step 2

## Step 2 — Select Projects (node `2703:175125` etc.)

- Multi-select list of projects to assign to the group
- Search by Name or Key
- Live preview org chart updates to show project assignments
- "Previous" + "Create Group" buttons

## States / Variants

Multiple variants exist for different form states (empty, partially filled, validation, etc.) — nodes `2703:175021` through `2703:185222`.

## Key UI Patterns

- Two-column layout: form left, live preview right
- File drop zone: dashed border, upload icon, "Click to upload or drag and drop" CTA
- Color picker: round colored chips in a 3×2 grid with selected state (outline)
- Org chart preview is a tree diagram with circular logo nodes connected by lines
- "Next" is disabled until required fields filled
