---
name: Tactile Aerospace Telemetry
colors:
  surface: '#101319'
  surface-dim: '#101319'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2eb'
  on-surface-variant: '#c5c9ac'
  inverse-surface: '#e1e2eb'
  inverse-on-surface: '#2d3037'
  outline: '#8f9378'
  outline-variant: '#444932'
  surface-tint: '#b0d500'
  primary: '#ffffff'
  on-primary: '#2a3400'
  primary-container: '#caf300'
  on-primary-container: '#596c00'
  inverse-primary: '#536600'
  secondary: '#ffb59a'
  on-secondary: '#5a1b00'
  secondary-container: '#ff5e07'
  on-secondary-container: '#531900'
  tertiary: '#ffffff'
  on-tertiary: '#68001a'
  tertiary-container: '#ffdada'
  on-tertiary-container: '#ca003b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#caf300'
  primary-fixed-dim: '#b0d500'
  on-primary-fixed: '#171e00'
  on-primary-fixed-variant: '#3e4c00'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb59a'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#802a00'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b6'
  on-tertiary-fixed: '#40000c'
  on-tertiary-fixed-variant: '#920028'
  background: '#101319'
  on-background: '#e1e2eb'
  surface-variant: '#32353b'
typography:
  headline-lg:
    fontFamily: Syne
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Syne
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Syne
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  metric-xl:
    fontFamily: JetBrains Mono
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  metric-lg:
    fontFamily: JetBrains Mono
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.02em
  metric-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.08em
  label-micro:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '500'
    lineHeight: 10px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system translates high-fidelity aerospace flight telemetry and tactile laboratory audio consoles into an ultra-dense, handheld OLED control interface. The visual language rejects ethereal, weightless digital conventions in favor of mechanical gravitas, machined chassis tolerances, and deliberate physical action.

### Design Movement & Aesthetic
- **Tactile Brutalism & Industrial Skeuomorphism**: The interface behaves as a precision-milled aluminum faceplate set flush into an OLED glass canvas. Controls feature milled channels, micro-chamfered bezels, sunken bed slots, and raised rotary caps.
- **Instrument Density**: Zero ornamental filler. Screen space is prioritized for high-information throughput, deterministic readouts, and immediate physical control surfaces.
- **Tactile Feedback Cues**: Visual depth relies entirely on specular highlight strokes, micro-bevel top edges, and sharp mechanical inset drop-shadows. There are no ambient neon washes or soft diffuse glows; active states behave like backlit mechanical keys, crisp precision LEDs, and incandescent filament indicators.

## Colors

The palette establishes an absolute contrast baseline on OLED hardware, isolating dynamic telemetry data against deep structural obsidian chassis surfaces.

### Surface Architecture
- **Canvas Base (`#090A0C`)**: Pure obsidian chassis surface; provides deep zero-energy OLED grounding.
- **Recessed Bed / Slot (`#0F1115`)**: Sub-surface milled wells, slider tracks, recessed toggle beds, and meter wells.
- **Card / Module Surface (`#16191F`)**: Elevated bento modules and physical modular sub-assemblies.
- **Elevated Switch / Cap (`#1F232B`)**: Raised keycaps, rotary encoders, and physical contact points.

### Borders & Structural Hairlines
- **Structural Stroke (`#282E38`)**: Standard 1.5px boundary defining faceplate panels and machined seams.
- **Engraved Stroke Active (`#3D4452`)**: Active boundaries, hovered modules, and engaged mechanical slots.

### Chromatic Signal Accents
- **Primary / Telemetry Active (`#D4FF00` - Acid Chartreuse)**: Real-time operational data, tracking reticles, rotary positions, and nominal status indicators.
- **Secondary / Warning & Gain (`#FF5C00` - Hyper Orange)**: Thermal thresholds, pre-amp overdrive, caution banners, and analog meter peaks.
- **Tertiary / Critical Gate (`#FF2A55` - Infrared Crimson)**: Emergency lockouts, armed telemetry abort triggers, and destructive purge circuits.

### Typography & Readout Contrast
- **Text Primary (`#F2F4F7`)**: Glacial off-white for zero-blur, high-legibility typographic reads.
- **Text Muted (`#7B8494`)**: Monospaced engineering units, axis markers, and mechanical labels.

## Typography

The typography establishes a strict hierarchy balancing architectural display character, micro-scale mobile UI legibility, and uncompromising numeric telemetry precision.

### Type Roles
- **Syne (Headers & Structural Sections)**: Imparts structural, engineered confidence. Rendered in heavy weights with tight tracking to mimic screen-printed aluminum chassis panels.
- **JetBrains Mono (Telemetry, Metrics & Micro-Labels)**: All measurements, sensor data, coordinates, status codes, and button sub-labels use monospaced figures with tabular alignment to eliminate jitter during real-time value updates.
- **Plus Jakarta Sans (UI Instructions & Body)**: Provides humanist balance for conversational logs, technical field notes, and instructional tooltips where monospaced density reduces reading speed.

### Text Styling Rules
- All `label-caps` and `label-micro` text must be transformed to uppercase with positive letter spacing (`0.08em` to `0.1em`).
- Numerical readouts should prioritize tabular lining figures (`font-variant-numeric: tabular-nums`).

## Layout & Spacing

Designed specifically for one-handed and thumb-centric operation on mobile displays (targeted at 412x915 dp Android screens), the layout adapts high-density aerospace switchboards into accessible touch zones.

### Grid Architecture
- **Chassis Margins**: Fixed `16px` (`margin`) outer screen margin creates a structural perimeter border simulating a physical enclosure bezel.
- **Columns**: 4-column layout on mobile with `12px` (`gutter`) channels. Controls snap to 1-column (rotary encoders, toggles), 2-column (fader banks, dual readouts), or 4-column full-width telemetry arrays.
- **Vertical Rhythm**: A strict 4px base unit. Internal component padding scales through `space-xs` (4px), `space-sm` (8px), `space-md` (12px), `space-lg` (16px), and `space-xl` (24px).

### Touch Targets vs. Visual Bounding Boxes
Visual elements (switches, buttons, knobs) maintain compact, high-density silhouettes (often 28px to 36px in physical presentation) but must expand via invisible bounding padding to guarantee a minimum `48x48 dp` interactive touch target.

## Elevation & Depth

Visual depth is strictly mechanical, achieved through multi-layered highlights, micro-bevels, and tight internal shadows rather than ambient atmospheric blurs.

### Surface Planes & Mechanical Layers
- **Recessed Channels (Level -1)**: Used for fader slots, slider runs, and toggle tracks. Constructed with an inset shadow (`inset 0 2px 4px rgba(0, 0, 0, 0.75), inset 0 -1px 0 rgba(255, 255, 255, 0.04)`), creating a downward step into the chassis.
- **Base Bed (Level 0)**: `#090A0C` background canvas, completely flat and non-reflective.
- **Faceplate Bento Modules (Level +1)**: `#16191F` background with a solid `1.5px` border of `#282E38`. Features a sharp mechanical top-edge highlight (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12)`) simulating top-down laboratory lighting reflecting off a machined edge.
- **Elevated Keycaps & Knobs (Level +2)**: `#1F232B` physical caps. Elevated using a directional shadow (`0 4px 6px -1px rgba(0, 0, 0, 0.6), 0 2px 4px -2px rgba(0, 0, 0, 0.4)`) combined with a top-lip bevel highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.18)`).

### Active & Engaged States
When an elevated keycap is pressed, it translates physically: elevation drops to 0, the directional drop shadow collapses, and the border transitions to `#3D4452` or the assigned accent color.

## Shapes

The design system employs a calibrated corner language to evoke CNC-milled instrument housings.

### Corner Radii
- **Chassis Modules & Bento Panels**: `16px` corner radius (`rounded-lg`). Gives large surfaces an approachable, ergonomic industrial contour.
- **Keycaps, Buttons & Controls**: `8px` corner radius (`rounded-md`). Balances sharp engineering discipline with tactile ergonomics.
- **Indicators, Chips & Pill Sliders**: `4px` corner radius or fully circular for status pin LEDs and rotary dials.

### Precision Hairlines
All structural surfaces feature a uniform `1.5px` solid border width. Thin `1px` lines are reserved exclusively for inner meter ticks and measurement scales.

## Components

### Buttons & Actuators
- **Primary Telemetry Push Button**: Surface `#1F232B`, 1.5px solid `#282E38`, top bevel highlight `inset 0 1px 0 rgba(255,255,255,0.18)`. Typographic label in JetBrains Mono `label-caps` in `#F2F4F7`. Left-side recessed LED indicator dot (6px) glowing `#D4FF00` when engaged.
- **Critical / Abort Trigger**: Recessed into a `#0F1115` slot. Base surface `#FF2A55` at 15% opacity with a solid `#FF2A55` 1.5px border and safety-striped diagonal micro-patterning. Requires hold-to-engage or spring-loaded mechanical flip gate.

### Sliders & Channels
- **Precision Linear Potentiometer (Fader)**: Recessed track in `#0F1115` with an inner shadow and center guide groove. Fader cap is an elevated `#1F232B` rectangular cap with horizontal grip ridges and a centered `#D4FF00` 2px indicator line. Flanked by JetBrains Mono numeric calibration ticks at 0, -6, -12, -24, and -∞.

### Chips & Status Indicators
- **Telemetry Tag**: Minimalist, compact height (22px). Background `#0F1115`, border 1px solid `#282E38`. Displays uppercase `label-micro` text in `#7B8494`, with real-time scalar values in `#F2F4F7`.
- **Status LED Pin**: 8x8px square or circle seated in a 1px recessed chamfer. Off: `#1F232B`. On: `#D4FF00` (Nominal), `#FF5C00` (Gain/Warning), or `#FF2A55` (Fault).

### Input Fields & Data Registers
- **Parameter Matrix Input**: Recessed surface `#0F1115` with 1.5px border `#282E38`. On focus, border sharpens to `#D4FF00` with no soft outer glow ring. Monospaced caret in `#D4FF00`. Upper-right label displaying memory register or telemetry channel ID (e.g., `CH.04 // ALT`).

### Cards & Modular Bento Panels
- **Instrumentation Bento**: Background `#16191F`, 16px corner radius, 1.5px border `#282E38`, top inner bevel `inset 0 1px 0 rgba(255,255,255,0.08)`. Headers contain an uppercase Syne title paired with an engraved status badge and micro terminal screws rendered in UI corners.

### Checkboxes & Physical Toggle Switches
- **Bistable Toggle Switch**: Recessed slot background `#0F1115` with a vertical 2-position rocker cap (`#1F232B`). When switched to "ON", the lower bezel reveals a mechanical `#D4FF00` accent flag and an audible micro-haptic trigger profile.
- **Matrix Verification Checkbox**: Square box (18x18px) with 2px radius. When checked, it renders a high-contrast mechanical crosshair (`+`) or solid block in `#D4FF00`, avoiding conventional rounded checkmarks.