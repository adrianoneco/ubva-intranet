# Design Guidelines for Full-Stack Monorepo Application

## Design Approach
**Selected Approach:** Design System - Material Design 3 adapted for modern web applications
**Justification:** Technical full-stack application benefits from consistent, scalable component patterns with strong hierarchy and clear interaction models. Material Design provides robust foundations for data-driven interfaces while maintaining visual polish.

## Typography System

**Font Families:**
- Primary: Inter (Google Fonts) - headings, UI elements, buttons
- Secondary: Source Sans Pro - body text, descriptions

**Type Scale:**
- Display: 3.5rem (56px) / font-bold - Hero headings
- H1: 2.5rem (40px) / font-bold - Page titles
- H2: 2rem (32px) / font-semibold - Section headers
- H3: 1.5rem (24px) / font-semibold - Card titles
- Body Large: 1.125rem (18px) / font-normal - Primary content
- Body: 1rem (16px) / font-normal - Standard text
- Small: 0.875rem (14px) / font-normal - Secondary text, captions

## Layout System

**Spacing Primitives:**
Use Tailwind units: **2, 4, 6, 8, 12, 16, 20** for consistent rhythm
- Component padding: p-4, p-6, p-8
- Section margins: mb-8, mb-12, mb-16
- Card spacing: space-y-4, gap-6

**Grid System:**
- Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Responsive columns: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Dashboard layouts: 12-column grid with flexible spans

## Component Library

**Navigation:**
- Top navbar: Fixed position, 64px height, contains logo, main navigation, user menu
- Sidebar (if dashboard): 256px width on desktop, collapsible to 64px icon-only mode, full overlay on mobile
- Breadcrumbs for nested navigation

**Cards:**
- Standard elevation with rounded-lg (8px radius)
- Padding: p-6 for content area
- Headers with border-b separator
- Actions positioned top-right or bottom-right

**Buttons:**
- Primary: Filled, font-semibold, px-6 py-3, rounded-lg
- Secondary: Outlined with 2px border, same padding
- Text: No border, px-4 py-2
- Icon buttons: w-10 h-10, rounded-full for circular style
- Buttons on images: Backdrop blur effect (backdrop-blur-sm bg-white/10 border border-white/20)

**Forms:**
- Input fields: h-12, px-4, rounded-lg, border-2 transition
- Labels: mb-2, font-medium, text-sm
- Field spacing: space-y-6 for form groups
- Validation states: Border changes, helper text below input

**Tables:**
- Striped rows for readability
- Sticky headers for long lists
- Row hover states with smooth transitions
- Action columns right-aligned

**Data Display:**
- Stats cards: Large numbers (2.5rem), label below, icon top-right
- Progress bars: h-2, rounded-full, smooth width transitions
- Badges: px-3 py-1, rounded-full, font-medium text-xs

## Page Layouts

**Landing/Marketing Page:**
- Hero section: min-h-screen with centered content, large hero image (full-bleed), primary CTA with blurred background
- Features grid: 3-column layout (lg), 2-column (md), 1-column (mobile) with icon-title-description pattern
- Benefits section: Alternating image-text layout with generous py-20 spacing
- Social proof: 3-column testimonial cards with customer photos
- CTA section: Centered, py-24, compelling copy with primary and secondary actions
- Footer: 4-column layout with navigation, company info, social links, newsletter signup

**Dashboard Interface:**
- Sidebar + main content area layout
- Dashboard grid: Stats cards in 4-column row, charts in 2-column below
- Header: Page title, actions (Add, Export, etc.), search/filters
- Content cards: Consistent spacing with shadow-sm elevation

**Detail Pages:**
- Breadcrumb navigation at top
- Page header: Title, meta info, action buttons
- Content sections with clear visual separation (border-t dividers, spacing)
- Sidebar for related info or actions (1/3 width)

## Interaction Patterns

**Navigation Flow:**
- Smooth page transitions
- Active states clearly indicated with border-b or background treatment
- Persistent navigation elements across views

**Loading States:**
- Skeleton screens for content loading
- Spinner for action feedback (button disabled state)
- Progressive disclosure for data-heavy views

**Feedback:**
- Toast notifications: Top-right position, auto-dismiss after 4s
- Inline validation on form blur
- Success states with checkmark icons
- Error states with clear messaging

## Responsive Behavior

**Breakpoints:**
- Mobile: Base (< 768px) - Single column, hamburger menu, bottom navigation for dashboards
- Tablet: md (768px-1024px) - 2-column layouts, sidebar toggleable
- Desktop: lg (1024px+) - Full multi-column layouts, persistent sidebar

**Adaptive Elements:**
- Data tables convert to cards on mobile
- Multi-step forms show progress differently
- Dashboard charts stack vertically on mobile

## Images

**Hero Image:**
Large, full-bleed hero image (1920x1080 minimum) showcasing the application's primary value proposition. Modern, tech-forward aesthetic. Position: Hero section background with gradient overlay for text legibility.

**Feature Section Images:**
3-4 product screenshots or illustrations (800x600) demonstrating key features. Clean, modern interfaces with subtle depth. Position: Alternating left-right in benefits section.

**Testimonial Photos:**
Customer headshots (200x200 circular crop) for social proof section. Professional but approachable.

---

**Key Principle:** Maintain clarity and consistency throughout. Every component should feel part of a cohesive system while serving its functional purpose efficiently.