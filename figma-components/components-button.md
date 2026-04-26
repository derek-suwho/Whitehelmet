# Component — Button

**File:** Web Components
**File Key:** `NsRL0OMxo3bzbdGXdNJOcQ`
**Node:** `149:990` (canvas page)
**Figma URL:** https://www.figma.com/design/NsRL0OMxo3bzbdGXdNJOcQ/Web-Components?node-id=149-990

## Component Properties

| Property | Values |
|----------|--------|
| Type | Primary, Secondary, Tertiary, Outline, Ghost, Destructive, Destructive Outline, Destructive Ghost, Success, AI |
| Size | Small, Default, Large |
| State | Default, Hover, Active, Focused, Disabled, Pressed, Hovered, Loading |

**Total variants: 203**

## Type Descriptions

| Type | Visual | Use Case |
|------|--------|----------|
| **Primary** | Solid brand purple/indigo fill, white text | Main CTAs (e.g. "+ Create", "Save") |
| **Secondary** | Lighter fill or outlined with brand color | Secondary actions |
| **Tertiary** | Minimal, low-emphasis | Tertiary / supporting actions |
| **Outline** | Transparent bg, brand-color border + text | Medium-emphasis actions |
| **Ghost** | No border, no fill, text only | Low-emphasis / inline actions |
| **Destructive** | Solid red fill, white text | Delete, archive, irreversible actions |
| **Destructive Outline** | Red border + red text | Destructive but less prominent |
| **Destructive Ghost** | Red text only | Inline destructive actions |
| **Success** | Solid green fill, white text | Confirm, approve, complete actions |
| **AI** | Purple gradient fill | AI-powered actions (Asif AI) |

## Sizes

| Size | Approx height | Use |
|------|--------------|-----|
| Small | ~28px | Dense UIs, table rows, tags |
| Default | ~36px | Standard usage |
| Large | ~44px | Hero / prominent CTAs |

## States

All interactive states defined: Default, Hover, Active (Pressed), Focused (keyboard), Disabled, Loading.

## Key Component Node IDs (samples)

| Variant | Node ID |
|---------|---------|
| Primary, Default, Default | `2002:591` |
| Primary, Default, Hover | `2002:595` |
| Primary, Default, Active | `2002:599` |
| Primary, Default, Disabled | `2002:603` |
| Primary, Small, Default | `2002:607` |
| Primary, Large, Default | `2002:638` |
| Secondary, Default, Default | `2002:654` |
| Outline, Default, Default | `2004:548` |
| Destructive, Default, Default | (in Destructive section) |
| Destructive Outline, Default, Default | `5366:1541` |
| Success, Default, Default | `5370:8984` |
| AI, Default, Default | `2004:295` |

## Additional Frame Nodes

| Frame | Node ID | Description |
|-------|---------|-------------|
| Icon Button Sizes | `5970:535` | Icon-only button size variants |
| Toggle Icon Button | `5970:552` | Toggle/icon button variant |

## Implementation Notes

- Icon optional on left or right of label
- Rounded corners (pill-style on most variants)
- Focus ring uses brand color outline offset
- Disabled state: reduced opacity, no pointer events
- Loading state: spinner replaces or precedes label
- Left icon: used for actions like "+ Create", "+ Add"
- Right icon: used for navigation/expand (e.g. "View All Groups >")
