# AlphaArena Design System

A comprehensive design system for building professional, consistent, and accessible UI components.

## Table of Contents

1. [Brand Identity](#brand-identity)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Border Radius](#border-radius)
6. [Shadows](#shadows)
7. [Components](#components)
8. [Animation](#animation)
9. [Accessibility](#accessibility)
10. [Usage Guidelines](#usage-guidelines)

---

## Brand Identity

### Core Values

- **Professional** - Financial-grade trading tools
- **Trustworthy** - Secure and reliable data handling
- **Tech-driven** - AI-powered intelligent strategies

### Design Principles

1. **Clarity over decoration** - Remove unnecessary elements
2. **Data-driven aesthetics** - Let information breathe
3. **Consistent experience** - Same patterns, same outcomes
4. **Accessible by default** - Everyone can use our product

---

## Color System

### Primary Colors

#### Tech Blue (Primary Brand Color)

Represents trust, professionalism, and technology.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary-50` | `#EFF6FF` | Very light backgrounds |
| `--color-primary-100` | `#DBEAFE` | Light backgrounds |
| `--color-primary-200` | `#BFDBFE` | Hover states (light) |
| `--color-primary-300` | `#93C5FD` | Disabled states |
| `--color-primary-400` | `#60A5FA` | Icons, accents |
| `--color-primary-500` | `#3B82F6` | **Main brand color** |
| `--color-primary-600` | `#2563EB` | Hover states |
| `--color-primary-700` | `#1D4ED8` | Active states |
| `--color-primary-800` | `#1E40AF` | Dark accents |
| `--color-primary-900` | `#1E3A8A` | Very dark accents |

#### Secondary Colors (Purple)

Represents innovation and AI.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-secondary-500` | `#A855F7` | Secondary actions |
| `--color-secondary-600` | `#9333EA` | Hover states |

### Semantic Colors

#### Success (Green)

For positive actions, confirmations, and profit indicators.

```css
--color-success-500: #10B981;  /* Main success color */
```

#### Warning (Orange)

For alerts, cautions, and attention-needed states.

```css
--color-warning-500: #F97316;  /* Main warning color */
```

#### Error/Danger (Red)

For errors, destructive actions, and loss indicators.

```css
--color-error-500: #EF4444;  /* Main error color */
```

#### Info (Blue)

For informational messages and neutral highlights.

```css
--color-info-500: #0EA5E9;  /* Main info color */
```

### Neutral Colors

Used for text, borders, and backgrounds.

| Token | Light Theme | Dark Theme | Usage |
|-------|-------------|------------|-------|
| `--color-bg-1` | `#ffffff` | `#0f172a` | Primary background |
| `--color-bg-2` | `#f8fafc` | `#1e293b` | Secondary background |
| `--color-bg-3` | `#f1f5f9` | `#334155` | Tertiary background |
| `--color-text-1` | `#0f172a` | `#f1f5f9` | Primary text |
| `--color-text-2` | `#475569` | `#cbd5e1` | Secondary text |
| `--color-text-3` | `#94a3b8` | `#94a3b8` | Tertiary text |
| `--color-border-1` | `#e2e8f0` | `#334155` | Primary border |

### Theme Support

The design system supports both light and dark themes:

```css
/* Light theme (default) */
:root, :root.light, :root[data-theme='light'] { ... }

/* Dark theme */
:root.dark, :root[data-theme='dark'] { ... }
```

---

## Typography

### Font Families

```css
/* Sans-serif (default) - For UI text */
--font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', ...

/* Monospace - For code and data */
--font-family-mono: 'SF Mono', 'Monaco', 'Inconsolata', ...

/* Display - For headings */
--font-family-display: 'Inter', -apple-system, ...
```

### Font Size Scale

Based on a modular scale with 1.25 ratio:

| Token | Size | Usage |
|-------|------|-------|
| `--font-size-xs` | 12px | Labels, badges, captions |
| `--font-size-sm` | 14px | Body small, secondary text |
| `--font-size-base` | 16px | Body text |
| `--font-size-lg` | 18px | Large body, H4 |
| `--font-size-xl` | 20px | H4 |
| `--font-size-2xl` | 24px | H3 |
| `--font-size-3xl` | 30px | H2 |
| `--font-size-4xl` | 36px | H1 |
| `--font-size-5xl` | 48px | Display |
| `--font-size-6xl` | 60px | Hero |

### Font Weights

```css
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Line Heights

```css
--line-height-tight: 1.25;    /* Headings */
--line-height-normal: 1.5;    /* Body text */
--line-height-relaxed: 1.625; /* Large text blocks */
```

### Typography Components

```html
<h1 class="h1">Page Title</h1>
<h2 class="h2">Section Title</h2>
<h3 class="h3">Card Title</h3>
<p class="body">Regular paragraph text</p>
<p class="body-sm">Secondary text</p>
<span class="caption">Small caption</span>
```

---

## Spacing

Based on a 4px grid system:

| Token | Size | Usage |
|-------|------|-------|
| `--spacing-0` | 0 | No spacing |
| `--spacing-1` | 4px | Tight spacing |
| `--spacing-2` | 8px | Compact spacing |
| `--spacing-3` | 12px | Small gaps |
| `--spacing-4` | 16px | Standard spacing |
| `--spacing-5` | 20px | Medium spacing |
| `--spacing-6` | 24px | Section padding |
| `--spacing-8` | 32px | Large sections |
| `--spacing-10` | 40px | Page sections |
| `--spacing-12` | 48px | Major sections |
| `--spacing-16` | 64px | Page margins |

### Spacing Utilities

```html
<div class="p-4">Standard padding</div>
<div class="m-2">Compact margin</div>
<div class="gap-3">Gap between items</div>
```

---

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `--radius-none` | 0 | No radius |
| `--radius-sm` | 4px | Badges, tags |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards |
| `--radius-xl` | 12px | Large cards |
| `--radius-2xl` | 16px | Modals |
| `--radius-3xl` | 24px | Feature cards |
| `--radius-full` | 9999px | Circular elements |

---

## Shadows

### Light Theme Shadows

```css
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), ...;
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), ...;
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), ...;
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), ...;
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

### Focus Ring

```css
--shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.3);
```

---

## Components

### Cards

```html
<!-- Standard card -->
<div class="card">
  <h3 class="h4">Card Title</h3>
  <p class="body-sm">Card content</p>
</div>

<!-- Interactive card with hover effect -->
<div class="card card-interactive">
  ...
</div>

<!-- Flat card (no shadow) -->
<div class="card card-flat">
  ...
</div>
```

### Buttons

```html
<!-- Primary button -->
<button class="btn btn-primary btn-md">Primary</button>

<!-- Secondary button -->
<button class="btn btn-secondary btn-md">Secondary</button>

<!-- Ghost button -->
<button class="btn btn-ghost btn-md">Ghost</button>

<!-- Danger button -->
<button class="btn btn-danger btn-md">Delete</button>

<!-- Outline button -->
<button class="btn btn-outline-primary btn-md">Outline</button>

<!-- Button sizes -->
<button class="btn btn-primary btn-xs">XS</button>
<button class="btn btn-primary btn-sm">SM</button>
<button class="btn btn-primary btn-md">MD</button>
<button class="btn btn-primary btn-lg">LG</button>
<button class="btn btn-primary btn-xl">XL</button>
```

### Inputs

```html
<!-- Standard input -->
<input type="text" class="input" placeholder="Enter text..." />

<!-- Small input -->
<input type="text" class="input input-sm" />

<!-- Large input -->
<input type="text" class="input input-lg" />

<!-- Error state -->
<input type="text" class="input input-error" />
```

### Badges

```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-danger">Danger</span>
```

---

## Animation

### Durations

```css
--duration-75: 75ms;    /* Micro-interactions */
--duration-100: 100ms;  /* Quick feedback */
--duration-150: 150ms;  /* Button clicks */
--duration-200: 200ms;  /* Standard transitions */
--duration-300: 300ms;  /* Page transitions */
--duration-500: 500ms;  /* Modal animations */
```

### Easing Functions

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);  /* Most common */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Animation Utilities

```html
<div class="transition-all">All transitions</div>
<div class="transition-colors">Color transitions</div>
<div class="transition-transform">Transform transitions</div>
```

---

## Accessibility

### Focus States

All interactive elements should have visible focus states:

```css
.focus-visible:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Color Contrast

- Text on background: minimum 4.5:1 ratio
- Large text (18px+): minimum 3:1 ratio
- UI components: minimum 3:1 ratio

### Touch Targets

- Minimum touch target size: 44x44px
- Minimum spacing between targets: 8px

### Reduced Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support

Use the `.sr-only` class for visually hidden content:

```html
<button>
  <span class="sr-only">Close dialog</span>
  <IconX />
</button>
```

---

## Usage Guidelines

### When to Use What

#### Colors

- **Primary**: Main CTAs, links, active states
- **Secondary**: Secondary actions, icons
- **Success**: Positive actions, confirmations, profit
- **Warning**: Alerts, cautions
- **Error**: Errors, destructive actions, losses
- **Neutral**: Text, borders, backgrounds

#### Typography

- **H1**: Page titles (once per page)
- **H2**: Section titles
- **H3**: Card titles, subsections
- **H4-H6**: Smaller headings
- **Body**: Main content
- **Body-sm**: Secondary content
- **Caption**: Labels, hints

#### Spacing

- **4-8px**: Within components
- **16-24px**: Between related elements
- **32-48px**: Between sections
- **64px+**: Page margins

### Do's and Don'ts

#### Do's

✅ Use semantic color tokens instead of raw colors
✅ Maintain consistent spacing using tokens
✅ Apply appropriate hover and focus states
✅ Use the provided typography scale
✅ Test both light and dark themes

#### Don'ts

❌ Don't use hardcoded color values
❌ Don't mix different spacing patterns
❌ Don't skip hover/focus states
❌ Don't use arbitrary font sizes
❌ Don't ignore accessibility requirements

---

## Integration with Arco Design

This design system extends and customizes Arco Design. The tokens are designed to work alongside Arco components:

```css
/* Override Arco theme variables */
:root {
  --arco-color-primary: var(--color-primary);
  --arco-color-success: var(--color-success);
  --arco-color-warning: var(--color-warning);
  --arco-color-danger: var(--color-danger);
}
```

### Arco Design Customization

To apply the design system to Arco components, ensure the design tokens are imported before Arco's styles:

```css
@import './design-tokens.css';
@import '@arco-design/web-react/dist/css/arco.css';
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-23 | Initial design system release |

---

## Resources

- [Design Specification](/.virtucorp/knowledge/research/ui-design-specification.md)
- [Design Tokens CSS](/src/client/styles/design-tokens.css)
- [Figma Library](#) (coming soon)

---

*Maintained by the AlphaArena Design Team*