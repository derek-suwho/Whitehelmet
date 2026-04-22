# Screen — Create Project

**File:** Project Structure: Screens
**File Key:** `tNdnPVIddkKCcL8HykfyMD`
**Reference Node (Step 1):** `2710:241224`
**Figma URL:** https://www.figma.com/design/tNdnPVIddkKCcL8HykfyMD/Project-Structure--Screens-?node-id=2710-241224

## Stepper

4-step wizard:
1. **Main Details**
2. Advanced Details
3. Data Management
4. User Management

---

## Step 1 — Main Details (`2710:241224`)

### Section: Project Overview (left) + Live Preview (right)

**Left — Fields:**

| Field | Type | Notes |
|-------|------|-------|
| Project Name | Text input | Required |
| Project Key | Text input | Required; auto-generated from name, editable |
| Upload Project Logo | File drop zone | SVG, PNG, or JPG (Max Size: 1MB) |
| Select Group | Dropdown | "Select Group"; optional — places project under group |

**Right — Live Preview:** Org chart tree (Org → Group → Project level highlighted)

### Section: Location (left) + Map Preview (right)

**Left — Fields:**

| Field | Type | Notes |
|-------|------|-------|
| Address | Text input | Required; reflects on map |
| Country | Dropdown | Cascading |
| City | Dropdown | Cascading from Country |

**Right — Map Preview:** Interactive map (Riyadh default); user can pick location

### Section: Scope & Ownership

| Field | Type | Notes |
|-------|------|-------|
| Project Type | Dropdown | Required |
| Project Total Area | Number input + unit selector (M²) | Required |
| Project Admin(s) | Multi-select dropdown | Required; min 1 |
| Project Manager(s) | Multi-select dropdown | Required; min 1 |

**Footer:** "Next" (Primary, right)

---

## Step 2 — Advanced Details (`2710:243426`)

### Section: Additional Information

| Field | Type |
|-------|------|
| Upload Project Photo | File drop zone (SVG, PNG, JPG) |
| Project Description | Textarea |
| ZIP Code | Text input |

### Section: Timeline

| Field | Type |
|-------|------|
| Start Date | Date picker (dd/mm/yyyy) |
| Completion Date | Date picker (dd/mm/yyyy) |

**Footer:** "Previous" + "Next" (Primary)

---

## Step 3 — Data Management (`2710:239346`)

### Section: Disciplines

- Description: "Define the disciplines that will be used across your project..."
- **Options** panel with "+ Add Other"
- Discipline entry: Name input + Key input + delete icon
- Suggestions: tag chips (Quality (QUA), Hydraulic (HYD), Mechanical (MEC), Construction (CON), Architectural (ARC), Structure (STR), Landscape (LAN))

### Section: Partners

- Description: "Add your project partners like clients, contractors..."
- "+ Add New Partner" button
- Sub-sections: **Clients**, **Contractors**, **Consultants**, **Project Management** — each with "+ Add Other"
- Client entry: logo upload + Client Name input

**Footer:** "Previous" + "Next" (Primary)

---

## Step 4 — User Management (`2710:243638`)

### Section: Project Users

- Left: "Select Users" multi-select dropdown (with search by name or email)
- Right: Two lists:
  - **Project Managers (N):** avatar + name + email + role dropdown (locked "Project Admin") + × remove
  - **Project Users (N):** avatar + name + email + role dropdown (editable) + × remove

**Footer:** "Previous" + "Create Project" (Primary)

---

## Group Selector Dropdown Detail (`7360:267272` — filled state)

When "Select Group" is open:
- Search by Group Name input
- Hierarchical list: Group name (with subgroups indented)
- Radio button selection
- Subgroups shown indented under parent

---

## Key UI Patterns

- Consistent two-column layout: form/config left, preview right
- Live org-chart preview updates with each selection
- File drop zones: dashed border, upload icon, click CTA, accepted formats note
- Map preview: real map tiles (Riyadh), click to position pin
- All required fields marked with red asterisk
- Stepper shows completed steps with checkmark icon
- "Next" disabled until required fields valid
- Breadcrumb not shown during wizard; back arrow exits wizard
