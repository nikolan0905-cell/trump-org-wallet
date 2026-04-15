# Design System Strategy: The Sovereign Command Interface

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Kinetic Monolith."**

We are moving away from the "web dashboard" aesthetic and toward a high-stakes, mission-critical terminal environment. The interface should feel like an active participant in a high-security operation—precise, intimidatingly fast, and surgically clean. We achieve this through **Intentional Brutalism**: a complete rejection of rounded corners (`0px` radius across the board) and a heavy reliance on atmospheric depth.

By utilizing stark, technical monospace typography and a palette that transitions from void-black to electric-blue, we create a "Heads-Up Display" (HUD) feel. This system breaks the standard grid through **Asymmetric Data Density**—clumping critical telemetry in high-contrast clusters while leaving vast areas of `surface_container_lowest` (#0E0E0E) to provide breathing room and focus.

---

## 2. Colors: The Void and The Signal
The palette is built on the tension between the "Void" (deep blacks/navies) and the "Signal" (electric pulses).

* **Primary (`#ABC7FF` to `#007FFF`):** This is your tactical signal. Use it for active data streams, cursor points, and critical navigation.
* **Tertiary/Error (`#FFB4A8` to `#FF0000`):** Reserved strictly for breach protocols and system failures. This color must disrupt the user’s flow.
* **The "No-Line" Rule:** 1px solid borders are strictly prohibited for layout sectioning. Boundaries are defined by the shift from `surface` (#131313) to `surface_container_low` (#1B1B1B). If you cannot distinguish two sections, increase the spacing—do not add a line.
* **Surface Hierarchy & Nesting:** Treat the UI as a physical console.
* **Base Layer:** `surface_container_lowest` (#0E0E0E) for the background.
* **Sub-Panels:** `surface_container` (#1F1F1F) for primary workspace areas.
* **Active Modules:** `surface_bright` (#393939) for transient overlays or focused states.
* **The Glass & Gradient Rule:** For "floating" diagnostic windows, use `surface_container_highest` (#353535) at 60% opacity with a `20px` backdrop-blur. Apply a subtle linear gradient from `primary` to `primary_container` on high-priority action buttons to give them a "powered-on" glow.

---

## 3. Typography: Technical Precision
We utilize a dual-font approach to balance raw data with structural hierarchy.

* **The Monospace Engine (Space Grotesk / JetBrains Mono):** Used for all `display`, `headline`, and `label` roles. This maintains the "Command Center" aesthetic.
* *Scale Note:* Use `display-lg` (3.5rem) sparingly for system status codes or clock-cycles to create a sense of scale.
* **The Functional Body (Inter):** Used for `body` and `title` roles. While the system feels like a terminal, readability in dense logs is paramount. Inter provides the legibility that monospace sometimes lacks in long-form text.
* **Visual Hierarchy:** High contrast is mandatory. Pair a `label-sm` in `on_surface_variant` (#C1C6D7) with a `headline-lg` in `primary` (#ABC7FF) to create an editorial, "classified document" feel.

---

## 4. Elevation & Depth: Tonal Stacking
In a "High-Alert" environment, traditional drop shadows feel too soft and "consumer." We use **Tonal Layering**.

* **The Layering Principle:** To lift an element, move it up the surface scale. A card sitting on `surface` (#131313) should be `surface_container_high` (#2A2A2A). This creates a "machined" look where parts appear to be inset or outset from a single piece of hardware.
* **Ambient Shadows:** If an element must float (e.g., a critical alert modal), use a shadow with a `40px` blur, `0%` spread, and `6%` opacity, using the `primary` color as the shadow tint. This mimics the glow of a phosphor screen reflecting off a dark surface.
* **The "Ghost Border" Fallback:** If accessibility requires a container edge, use `outline_variant` (#414754) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Machined Primitives

### Buttons (Hard-Edged)
* **Primary:** Solid `primary_container` (#448FFF), `0px` radius. Text in `on_primary_container`. On hover, apply a `primary` outer glow.
* **Tertiary (Alert):** Solid `tertiary_container` (#FF5540). Use only for "Purge," "Disconnect," or "Terminate."

### Input Fields
* No background fill. Use a `surface_container_highest` (#353535) bottom-bar only. When active, the bottom bar transitions to `primary` (#ABC7FF) and triggers a subtle `primary_fixed_dim` glow behind the text.

### Cards & Lists
* **Forbid Dividers:** Separation is achieved via `1.75rem` (Spacing 8) of vertical whitespace.
* **Data Rows:** Alternate backgrounds between `surface_container_low` and `surface_container_lowest` for readability in high-density logs.

### Tactical Components
* **Status Pulse:** A small 4px square utilizing the `tertiary` color with a CSS-keyed "ping" animation to indicate high-alert zones.
* **Scanline Overlay:** A persistent, low-opacity (2%) horizontal gradient moving vertically across the `surface` layer to simulate a CRT refresh.

---

## 6. Do’s and Don’ts

### Do:
* **Embrace the 0px Radius:** Everything is a sharp edge. Softness is the enemy of security in this visual language.
* **Use Intentional Asymmetry:** Align terminal logs to the left and tactical metadata to the right with different column widths (e.g., 60/40 split).
* **Use "On-Surface" Variants:** Use `on_surface_variant` (#C1C6D7) for secondary data to ensure the primary data "pops" off the screen.

### Don’t:
* **No Rounded Corners:** Never use `border-radius`. Not even on checkboxes.
* **No Standard Blue:** Avoid "browser blue." Use only the specific `primary` (#ABC7FF) and its variants to maintain the cold, electric feel.
* **No Centered Layouts:** Command centers are functional. Align to the top-left; centering feels like a marketing landing page, not a tool for high-level operatives.