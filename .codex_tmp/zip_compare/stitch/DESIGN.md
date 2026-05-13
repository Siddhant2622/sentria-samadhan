---
name: Sentira AI Design System
colors:
  surface: '#fbf9fb'
  surface-dim: '#dbd9db'
  surface-bright: '#fbf9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f5'
  surface-container: '#efedef'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#44474d'
  inverse-surface: '#303032'
  inverse-on-surface: '#f2f0f2'
  outline: '#75777e'
  outline-variant: '#c5c6cd'
  surface-tint: '#515f78'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0d1c32'
  on-primary-container: '#76849f'
  inverse-primary: '#b9c7e4'
  secondary: '#0059bb'
  on-secondary: '#ffffff'
  secondary-container: '#0070ea'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b1701'
  on-tertiary-container: '#9f7d5b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b9c7e4'
  on-primary-fixed: '#0d1c32'
  on-primary-fixed-variant: '#39475f'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc7ff'
  on-secondary-fixed: '#001a41'
  on-secondary-fixed-variant: '#004493'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#e7bf99'
  on-tertiary-fixed: '#2b1701'
  on-tertiary-fixed-variant: '#5d4124'
  background: '#fbf9fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  margin-mobile: 20px
  gutter: 16px
  card-padding: 16px
  stack-gap: 12px
---

## Brand & Style

The brand personality is **Intelligent, Transparent, and Trustworthy**. This design system balances "Government-Grade" authority with the frictionless efficiency of high-end consumer apps. It aims to evoke a sense of calm reliability during civic distress while signaling high-tech AI processing through its visual language.

The aesthetic utilizes **Modern Glassmorphism** and **Minimalist Precision**. By combining high-density information layouts (Notion-inspired) with smooth, kinetic interactions (Uber/Swiggy-inspired), the system ensures that complex civic data feels accessible and actionable. Visual depth is achieved through translucent layers and subtle mesh gradients rather than heavy shadows, maintaining a clean, futuristic "command center" feel for the everyday citizen.

## Colors

The palette is rooted in **Trust and Actionability**. 

- **Primary (Midnight Navy):** Used for headers, primary branding, and structural elements to establish authority.
- **Electric Blue Accent:** Represents the "AI" layer. Used for active states, intelligence indicators, and high-priority interactions.
- **Semantic Statuses:** Success Green, Warning Orange, and Emergency Red are used sparingly but boldly to communicate the lifecycle of a grievance.
- **Surface Gradients:** Backgrounds should utilize very subtle linear gradients (e.g., `#F8FAFC` to `#FFFFFF`) to prevent the interface from feeling "flat" or "static." 

In Dark Mode, surfaces transition to a deep Indigo-Slate to maintain legibility while preserving the futuristic aesthetic.

## Typography

This system uses **Inter** for its exceptional legibility and systematic feel. The hierarchy is designed to highlight status and urgency.

- **Display & Headlines:** Use tight letter-spacing and bold weights to convey modern authority.
- **Body Text:** Optimized for long-form grievance descriptions with generous line-height for readability.
- **Labels:** Uppercase styles are used for metadata (e.g., "TICKET ID", "LOCATION") to differentiate system-generated data from user input.

## Layout & Spacing

The system follows a **4px baseline grid** with a fluid 4-column layout for mobile devices. 

- **Margins:** A standard 20px horizontal margin ensures content does not feel cramped against the bezel.
- **Stacking:** Elements use a consistent 12px or 16px vertical gap to maintain a "breathable" list view, essential for high-stress civic reporting.
- **Safe Areas:** Interactive elements like Floating Action Buttons (FABs) are anchored 24px from the bottom and right edges, respecting device safe zones.

## Elevation & Depth

Depth is communicated through **Glassmorphism and Tonal Stacking** rather than traditional shadows.

- **Level 1 (Base):** Off-white or deep indigo background.
- **Level 2 (Cards):** Solid white or slate surfaces with a 1px low-contrast border (`rgba(0,0,0,0.05)`).
- **Level 3 (Interactive/Floating):** Translucent "Glass" layers using `backdrop-filter: blur(12px)` and a thin internal highlight stroke at the top to simulate light hitting the edge.
- **Shadows:** Only used for the highest level of elevation (Modals and FABs), employing a "Long-Soft" shadow style: `0px 20px 40px rgba(0, 25, 50, 0.1)`.

## Shapes

The design system uses a **Refined Rounded** aesthetic. 

- **Primary Cards:** 1rem (16px) corner radius creates a friendly, approachable feel.
- **Buttons & Inputs:** 0.75rem (12px) radius strikes a balance between professional and modern.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Visual Continuity:** Inner elements (like images inside a card) should have a radius that is 4px smaller than the parent container for visual harmony.

## Components

### Interactive Cards
Grievance cards feature a 3-layer architecture: a bold status indicator at the top right, a primary title, and a "Live Progress" bar at the bottom. The entire card should have a subtle scale-down effect (0.98) on tap.

### Floating Action Button (FAB)
The "Report Grievance" button is a large, circular Electric Blue button with a subtle glow effect (`box-shadow` matching the accent color at low opacity). It features a clean "+" icon that rotates 45 degrees when a sub-menu opens.

### Animated Progress Tracker
Inspired by delivery apps, the tracker uses a vertical or horizontal line with "pulsing" nodes. Completed steps are Success Green, the current step is a pulsing Electric Blue, and pending steps are muted gray.

### Glassmorphic Modals
Modals slide up from the bottom and utilize a heavy backdrop blur (20px+) to keep the user focused on the task while maintaining environmental context.

### Input Fields
Inputs are "Ghost" style—transparent backgrounds with a 1px border that glows Electric Blue when focused. Labels float to the top-left in a condensed caps style.