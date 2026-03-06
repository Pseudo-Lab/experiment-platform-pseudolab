# Initiative Project: Design System & UI Consistency Guide

This document outlines the core design principles, typography, colors, and layout structures for the Initiative project to ensure a consistent user experience across all web pages.

## 1. Core Principles
- **Modern & Clean:** Utilize generous whitespace, subtle borders, and smooth transitions.
- **Accessible:** Rely on sufficient color contrast and accessible DOM structures (powered by Radix UI primitive components under shadcn/ui).
- **Responsive:** Fluidly adapt to different screen sizes (mobile, tablet, desktop) using standard Tailwind breakpoints.

## 2. Color Palette (Tailwind + Shadcn)
We use a slate-based gray scale coupled with Indigo primary accents. 

| Role | CSS Variable | Light Mode (HSL) | Dark Mode (HSL) |
| --- | --- | --- | --- |
| **Background** | `--background` | `0 0% 100%` (White) | `222.2 84% 4.9%` (Dark Slate) |
| **Foreground** | `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` |
| **Primary** | `--primary` | `222.2 47.4% 11.2%` (Indigo tint) | `210 40% 98%` |
| **Primary FG** | `--primary-foreground` | `210 40% 98%` | `222.2 47.4% 11.2%` |
| **Border / Input**| `--border` / `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` |

*Usage Tip:* For arbitrary colors that must match the brand, prefer `text-indigo-600` for light mode and `dark:text-indigo-400` for dark mode emphasis.

## 3. Typography
- **Font Family:** System default sans-serif (Inter/Roboto styled via Tailwind's `font-sans`).
- **Headings:**
  - `h1`: `text-2xl md:text-3xl font-extrabold tracking-tight`
  - `h2`: `text-xl font-bold tracking-tight`
  - `h3`: `text-lg font-semibold`
- **Body Text:**
  - Base: `text-base text-slate-700 dark:text-slate-300`
  - Small / Muted: `text-sm text-slate-500 dark:text-slate-400`

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
