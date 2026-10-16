---
name: Terminal Noir
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#bec7d2'
  on-secondary: '#29313a'
  secondary-container: '#414a53'
  on-secondary-container: '#b0b9c4'
  tertiary: '#ffb3af'
  on-tertiary: '#650911'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae3ee'
  secondary-fixed-dim: '#bec7d2'
  on-secondary-fixed: '#141c24'
  on-secondary-fixed-variant: '#3f4850'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
  surface-canvas: '#0d1117'
  surface-subtle: '#12151a'
  surface-panel: '#161b22'
  surface-raised: '#21262d'
  border-subtle: '#21262d'
  border-muted: '#30363d'
  border-accent: '#10b981'
  text-primary: '#f0f6fc'
  text-secondary: '#c9d1d9'
  text-muted: '#8b949e'
  accent-emerald: '#10b981'
  accent-emerald-bright: '#34d399'
  accent-emerald-glow: rgba(16, 185, 129, 0.15)
  status-danger: '#f85149'
  status-warning: '#d29922'
  mask-glyph: '#484f58'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.01em
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  secret-mask:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.18em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-ui:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system embodies a technical, security-first ethos tailored for modern software engineers, devops practitioners, and security architects. Taking cues from Linear's surgical precision, Notion's structural fluidity, and GitHub's utilitarian clarity, the interface acts as an encrypted digital cockpit.

The visual style blends **Dark-Mode Minimalism** with **Subtle High-Tech Skeuomorphism**—using matte deep obsidian and charcoal planes, hairline 1px structural dividers, faint dot-matrix grid canvases, and precise monospace anchors. The emotional target is calm competence, uncompromised confidentiality, and zero-latency keyboard fluidity. Visual clutter, playful illustrations, and decorative animations are strictly excluded in favor of purposeful information density, precise cryptographic states, and masked confidentiality primitives.

## Colors

The palette revolves around deep, low-reflectance charcoal and pitch-black surfaces punctuated by a laser-precise emerald green (#10b981 / #34d399) reserved strictly for cryptographic verification, active vault locks, and clean execution cues.

- **Backgrounds:** Multi-tiered matte charcoal hierarchy starting with the root canvas `#0d1117`, moving to `#12151a` for editor panels, and `#161b22` for floating pallets or sidebars.
- **Borders & Dividers:** Built using razor-sharp 1px lines (`#21262d` and `#30363d`) to demarcate functional regions without heavy fills or visual noise.
- **Text & Foreground:** High-legibility crisp white `#f0f6fc` for headings and primary content, tempered by muted technical grays (`#c9d1d9` and `#8b949e`) for structural syntax, metadata, and breadcrumbs.
- **Security Rule:** Status conditions (e.g., locked, synced, failed, rotating) must never be conveyed via hue alone; all status signals require accompanying SVG lock/shield glyphs or explicit monospace badges.

## Typography

The typographic engine balances rapid prose capture with raw programmatic utility:

- **Inter** handles narrative clarity, markdown documentation, top-level headings, and interactive UI chrome with tight, tracking-calibrated letter-spacing.
- **JetBrains Mono** powers environment variables (`KEY=VALUE`), inline snippets, cryptographic hashes, masked secret representations (`••••••••`), and slash command shortcut cues.
- High contrast hierarchy ensures effortless visual skimming during long terminal and editing sessions. Microcopy labels and security indicators use uppercase monospaced styling (`label-mono`) with expanded letter spacing for tactical legibility.

## Layout & Spacing

The spatial architecture prioritizes a keyboard-driven canvas alongside a razor-thin structural navigation frame:

- **Root Canvas Structure:** A collapsible 240px utility sidebar on the left, an unrestricted central note-taking and block-execution canvas (capped at 840px max width when reading for ergonomic line lengths, or dynamic full-width for multi-column dashboards), and an optional right contextual drawer for cryptographic metadata and table-of-contents.
- **Background Grid:** The central canvas features a subtle CSS micro-dot grid pattern (`radial-gradient(#21262d 1px, transparent 1px)` with 24px grid sizing) to establish an engineered drawing board atmosphere.
- **Responsive Adaptability:** On mobile viewports (<768px), sidebars collapse entirely into an off-canvas drawer accessible via high-speed gesture or bottom bar, and multi-column block arrangements (`/columns`) seamlessly collapse into vertical flex stacks.
- **Spacing Rhythm:** Standard spacing increments adhere to strict 4px multiples (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 12px, `space-lg` = 20px, `space-xl` = 32px), eliminating visual jitter between markdown blocks.

## Elevation & Depth

Visual hierarchy rejects blurred realistic dropshadows and heavy physical depth in favor of **structural containment** and **subtle luminance shifts**:

- **Tier 0 (Root Canvas):** `#0d1117` base level with micro-dot grid patterning.
- **Tier 1 (Panels & Sidebar):** `#12151a` bordered with 1px `#21262d` solid outline.
- **Tier 2 (Floating Pickers & Modals):** The Slash Command picker (`/`), Quick Switcher (`Cmd+K`), and contextual action popovers float over `#161b22` surfaces with a 1px border of `#30363d` and an ultra-diffused, ambient perimeter shadow: `0 8px 24px rgba(0, 0, 0, 0.65)`.
- **Active Focus & Security Ring:** Active blocks, focused inputs, and revealed credential panels carry a razor 1px accent outline in `#10b981` paired with a delicate soft ring glow: `0 0 0 1px #10b981, 0 0 12px rgba(16, 185, 129, 0.2)`.

## Shapes

The design system employs a disciplined, slightly softened architectural geometry (Level 1). Interactive controls, badge chips, input boundaries, and slash command list items adopt a tight 4px (`0.25rem`) corner radius. Larger containers, credential cards, floating search modals, and syntax blocks scale moderately to 8px (`0.5rem`). Circular shapes are prohibited except for user status avatars, encryption lock badges, and mask dot indicators (`•`).

## Components

### Buttons & Quick Actions
- **Primary Security Button:** Emerald background (`#10b981`), pitch-dark typography (`#0d1117`), font weight 600. On hover: `#34d399` with `box-shadow: 0 0 12px rgba(16, 185, 129, 0.35)`.
- **Ghost/Tertiary Tooling Action:** Transparent background, 1px border (`#21262d`), text `#c9d1d9`. On hover: surface `#161b22`, border `#30363d`, text `#f0f6fc`.
- **Keyboard Shortcut Affordance:** Inline badge inside buttons (`Kbd`) with `#21262d` background, `#8b949e` mono text, and 1px border `#30363d`.

### Slash Command Picker (`/`)
- Floats anchored adjacent to the caret.
- Max height 320px with custom 4px monospaced scrollbar.
- Group headers labeled in uppercase mono (`label-mono`, `#8b949e`).
- Active items highlighted in `#21262d` with a 2px vertical emerald indicator bar on the left edge.

### Encrypted Credential Cards & `.env` Secret Blocks
- **Container:** Dark matte `#12151a` backdrop with 1px `#21262d` perimeter border.
- **Key-Value Row:** JetBrains Mono typography. Left-aligned variable key (`#f0f6fc`), right-aligned masked glyph cluster (`••••••••••••`, `#484f58`).
- **Reveal & Copy Action:** Integrated toggle button with eye and clipboard icons. Revealing triggers a subtle countdown timer progress ring before auto-remasking after 15 seconds.
- **Security Lock Badges:** Pill indicator featuring an SVG lock symbol and emerald dot with text `AES-256 GCM`.

### Markdown Live Editor Blocks
- **H1–H3:** Distinct typographic scales with hover-revealed anchor links.
- **Code Fences:** Header bar showing language badge and one-click copy, background `#161b22`, horizontal auto-scroll without layout shifts.
- **Blockquotes / Callouts:** Left 3px solid border in `#10b981` (security alert) or `#30363d` (general note) with background `rgba(22, 27, 34, 0.6)`.

### Inputs & Search Bars
- Background `#161b22`, border 1px `#21262d`, text `#f0f6fc`, placeholder `#8b949e`.
- Focus state activates crisp emerald border `#10b981` without browser-default blue outlines.