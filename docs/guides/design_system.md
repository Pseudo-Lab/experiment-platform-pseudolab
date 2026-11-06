Status: active
Last-Validated: 2026-11-06

# Iterglow: Design System & UI Consistency Guide

This document outlines the core design principles, typography, colors, and layout structures for Iterglow to ensure a consistent user experience across all web pages.

## 1. Core Principles
- **Modern & Clean:** Utilize generous whitespace, subtle borders, and smooth transitions.
- **Accessible:** Rely on sufficient color contrast and accessible DOM structures (powered by Radix UI primitive components under shadcn/ui).
- **Responsive:** Fluidly adapt to different screen sizes (mobile, tablet, desktop) using standard Tailwind breakpoints.

## 2. Color Palette (Tailwind + Shadcn)
Iterglow uses the approved neutral v4 palette in light mode only. Large surfaces stay cool neutral gray or off-white; the original coral logo and dark coral links provide small accents. The workspace uses ink primary buttons; public introduction, sign-in and SDK documentation use the `.service-entry` coral primary override. Do not add beige surfaces, purple brand gradients, or a dark theme toggle.

| Role | CSS Variable | Light value |
| --- | --- | --- |
| Background | `--background` | `#f1f2f3` |
| Card / popover | `--card` / `--popover` | `#fafafa` |
| Foreground / workspace primary | `--foreground` / `--primary` | `#282b2e` |
| Secondary / muted / hover | `--secondary` / `--muted` / `--accent` | `#e8eaec` |
| Muted foreground | `--muted-foreground` | `#5d6064` |
| Border / input | `--border` / `--input` | `#d4d7da` |
| Focus ring / public primary | `--ring` / `.service-entry --primary` | `#a52e23` |

Use semantic Tailwind tokens instead of hardcoded slate or indigo for shared UI. Preserve semantic success/error colors and verify their text contrast against the rendered surface. Google sign-in uses the multicolor G with a white button, dark label, visible border and at least 44px height; do not recolor it to match Iterglow.

## 3. Typography
- **Font Family:** System default sans-serif (Inter/Roboto styled via Tailwind's `font-sans`).
- **Headings:**
  - `h1`: `text-2xl md:text-3xl font-extrabold tracking-tight`
  - `h2`: `text-xl font-bold tracking-tight`
  - `h3`: `text-lg font-semibold`
- **Body Text:**
  - Base: `text-base text-foreground`
  - Small / Muted: `text-sm text-muted-foreground`

## 4. Components (shadcn/ui Strategy)
All shared interactive elements **must** be generated using the shadcn/ui CLI to maintain accessibility and structural consistency.

- **Adding a component:** `npx shadcn@latest add [component-name]`
- **Buttons:** Use the generated `<Button>` component instead of raw `button` tags. Rely on `variant` props (e.g., `default`, `outline`, `ghost`, `destructive`) instead of custom background colors.
- **Cards:** For dashboard stats and experiment lists, use the `<Card>`, `<CardHeader>`, `<CardTitle>`, and `<CardContent>` structure instead of raw `div` tags with custom borders.
- **Inputs:** Use the `<Input>` component to ensure focus rings and borders match the global `--ring` and `--input` tokens.

## 5. Layout Defaults
- **Page Container:** `max-w-7xl mx-auto px-4 md:px-8 space-y-8`
- **Spacings:** 
  - Sections: `gap-8` or `space-y-8`
  - Items in lists/cards: `gap-4` or `gap-6`
- **Corners (Border Radius):** Always map to the theme `radius` (e.g., `rounded-lg`, `rounded-xl`, `rounded-2xl` for large cards). Hardcoded pixels should be avoided.
