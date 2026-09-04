---
name: web-design-guidelines
description: Audits UI code against Web Interface Guidelines, WCAG 2.1 AA accessibility, and St. Adelaide Cambridge Enterprise Design tokens. Use when asked to "review UI", "audit design", "check accessibility", or "review UX".
metadata:
  author: hectech
  version: "2.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface & Institutional Design Guidelines

Audits frontend code for accessibility, layout stability, visual hierarchy, and institutional design compliance.

## Core Rules Checklist

### 1. Accessibility & Contrast (WCAG 2.1 AA)

- **Contrast Ratios:** Text must have a minimum contrast ratio of 4.5:1 against its background (3:1 for large text $\ge 18\text{pt}$ / bold $14\text{pt}$).
- **Focus Rings:** Never remove focus outlines (`outline-none`) without providing an explicit, high-contrast replacement (e.g., `focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2`).
- **Interactive Targets:** Buttons, icon triggers, and dropdown items must maintain a minimum hit target of $44 \times 44\text{px}$ on touch or mobile views.
- **ARIA & Semantics:**
  - Dialogs must use `role="dialog"`, `aria-modal="true"`, and link to an `aria-labelledby` title.
  - Icon-only buttons must declare an `aria-label`.
  - Form inputs must be linked to `<label>` elements via `htmlFor` and `id`.

### 2. Typography & Numerical Data

- **Tabular Numbers:** All scores, percentages, period counts, and currency figures must use `font-mono` or `tabular-nums` to prevent horizontal layout shift during live updates.
- **Visual Hierarchy:** Maintain strict type scale pairing. Avoid using identical font sizes with slightly different gray shades to represent hierarchy; vary font-weight (`font-semibold`, `font-medium`) and scale intentionally.

### 3. St. Adelaide Design Tokens & Anti-AI-Slop

- **Color Discipline:** Enforce institutional palette tokens:
  - Deep Academy Navy: `#0B132B`, `#1C2541` (Primary text, active tabs, dark headers).
  - Clean Chalk: `#F8FAFC`, `#FFFFFF` (Surface backgrounds).
  - Hairline Borders: `#E2E8F0`, `#CBD5E1` (Use crisp $1\text{px}$ borders instead of fuzzy box-shadows).
  - Academic Accents:
    - Pass ($\ge 70\%$): Deep Emerald (`#15803D`, bg `#F0FDF4`, border `#BBF7D0`).
    - Deficit / Partial: Amber (`#B45309`, bg `#FFFBEB`, border `#FDE68A`).
    - Action Required: Crimson (`#B91C1C`, bg `#FEF2F2`, border `#FECACA`).
- **Eliminate AI Clichés:** Flag and remove unstyled floating gray cards (`bg-white shadow-sm rounded-xl border border-gray-200`), random purple gradients, and excessive empty padding.

### 4. Layout Stability & Print Styles

- **No Layout Shifts (CLS):** Reserve explicit width/height or aspect-ratio for async badges, dropzone loading states, and dynamic status pills.
- **Native Print Ergonomics:** In modal evaluation sheets (`AuditDetailsModal.tsx`), verify that `@media print` rules hide modal backdrops, action buttons, and scroll bars so `Ctrl+P` outputs a clean institutional document.

### 5. Interactive Polish & Dropzone Guardrails

- **Dropzone States:** Upload areas must provide distinct visual states for idle, drag-over, uploading (progress bar), and error/success.
- **Empty States:** Tables and list views must have actionable empty states with helpful guidance, not blank white containers.

---

## Output Format

When reviewing files, output findings in terse `file:line` format:

```text
path/to/file.tsx:line - [SEVERITY] Rule violation description
  ↳ Recommended fix or replacement snippet
