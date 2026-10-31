# Corbel UI/UX Reference Analysis → Nexora CRM Blueprint

> **What this is.** A product/QA teardown of the Corbel demo (`https://demo.codeandchill.store/corbel/`), written as a reference for rebuilding Nexora CRM as an enterprise sales SaaS. Every screen was opened, every major button clicked, and the result recorded. The last sections map each Corbel pattern to a Nexora feature and propose how we build it.
>
> **Tested on:** 31 Oct 2026, Chrome desktop, 1536×735 viewport, light + dark themes, Mono + Ocean palettes.
>
> **Legal note.** Corbel is a commercial template ("Buy this template", © Code & Chill / OVERSHOOT). We use it **only as a design and UX reference**. We do **not** copy its code, CSS, copy-text, data or assets. Nexora gets its own design tokens, components and wording that follow the same *principles*.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Tech stack Corbel uses](#2-tech-stack-corbel-uses)
3. [Information architecture: all screens and routes](#3-information-architecture-all-screens-and-routes)
4. [Global app shell](#4-global-app-shell)
5. [Design system: look and feel](#5-design-system-look-and-feel)
6. [Theme: light/dark mode and colour palettes](#6-theme-lightdark-mode-and-colour-palettes)
7. [Screen-by-screen teardown (with test results)](#7-screen-by-screen-teardown-with-test-results)
8. [Interaction pattern catalogue](#8-interaction-pattern-catalogue)
9. [Charts and data visualisation catalogue](#9-charts-and-data-visualisation-catalogue)
10. [Automations deep dive](#10-automations-deep-dive)
11. [Downloads, exports and invoices](#11-downloads-exports-and-invoices)
12. [How data flows in Corbel](#12-how-data-flows-in-corbel)
13. [Gaps: what Corbel fakes that we must build for real](#13-gaps-what-corbel-fakes-that-we-must-build-for-real)
14. [Mapping Corbel → Nexora CRM](#14-mapping-corbel--nexora-crm)
15. [Nexora target architecture](#15-nexora-target-architecture)
16. [Phased build plan](#16-phased-build-plan)
17. [Open decisions for the owner](#17-open-decisions-for-the-owner)

---

## 1. Executive summary

Corbel is a sales dashboard for a shop that sells online and in physical stores. It has **13 screens**, a **top pill navigation**, a **floating left dock**, and a calm "frosted glass on a soft gradient mesh" look. Dark mode and four colour palettes all come from CSS variables.

What makes it feel premium:

| Quality | How Corbel achieves it |
|---|---|
| Calm, airy | Lots of whitespace, big 22–28px radii, translucent "glass" cards over a blurred colour mesh, low-contrast borders |
| Alive | Animated number counters, a live "1,4xx live now" ticker that changes every few seconds, charts that draw in, staggered card entrances |
| Fast to use | Ctrl/⌘K command palette, deep links for every record (`#/orders/10476`), side sheets instead of page loads, Enter-to-save inline edits |
| Honest feedback | Every action produces a toast ("Ledgerly connected", "Exported …csv", "Test run passed"); autosave shows "Last edited: just now" |
| One hero per row | Each KPI row has one **inverted (dark) tile** as the focal point; the rest are light |
| Status everywhere | Small coloured dot + label pills (Pending / Paid / Shipped / Active / Paused / Connected) |

**The big gap:** Corbel is a front-end mock-up. All data lives in the browser's `localStorage`, automation steps can only be renamed, invoices download as `.txt`, and there is no auth or server. Nexora must make every one of these real (see §13).

---

## 2. Tech stack Corbel uses

Found by inspecting the bundle (not by copying it):

| Layer | Corbel |
|---|---|
| Framework | **Vanilla TypeScript + Vite**, no React, Vue or UI kit. Each screen is a lazily loaded chunk (`dashboard-*.js`, `orders-*.js` …) |
| Styling | Hand-written CSS with **CSS custom properties** (design tokens). Per-screen CSS chunks |
| Animation | **GSAP** for counters, chart draw-in, card drag and sheet slide-in |
| Font | **Urbanist** (Google Fonts, variable 400–700). The sister template "Tend" uses Geist |
| Charts | **Hand-drawn SVG**, no chart library |
| Routing | Hash router (`#/orders/10476`). All 13 views are `<section class="view" data-view="…">` elements toggled with `hidden` |
| Modals | Native `<dialog>` elements (`.modal` is centred, `.sheet` slides in from the right) |
| State | A single `localStorage` blob (`tend:v1`, seeded once) plus `corbel:theme`. Theme is set on `<html data-theme data-palette>` before first paint to avoid a flash |
| A11y | Skip link, `aria-live` regions for toasts and counts, labelled icon buttons, Esc closes every overlay, visible focus rings |

**What Nexora will use instead** (decision from the previous planning round): React 18 + Vite + TypeScript + **MUI v6 restyled with our own CSS-variable tokens**, **Framer Motion** for animation, **Recharts** (already in the repo) restyled to the same minimal look, and **React Router** with real URLs. Section 15 has the details.

---

## 3. Information architecture: all screens and routes

### 3.1 Primary navigation (top pill bar)

`Dashboard · Orders (badge 14) · Products · Customers · Messages (badge 3) · Analytics · Automations`

Badges are live counts. The Orders badge counts open orders and the Messages badge counts unread threads. Both drop as you act (Orders went 14 → 13 after marking one shipped; Messages went 3 → 2 after reading).

### 3.2 Every view and route

| # | View | Route(s) | Reached from | Sub-tabs |
|---|---|---|---|---|
| 1 | Dashboard | `#/dashboard` | Top nav, logo | Overview / Online / In store |
| 2 | Orders | `#/orders`, `#/orders/:id` (sheet) | Top nav, dashboard "See orders" | Status pills: All, Pending, Paid, Packed, Shipped, Delivered, Closed |
| 3 | Products | `#/products`, `#/products/:id` (sheet) | Top nav | Category, status, Grid/Table |
| 4 | Customers | `#/customers`, `#/customers/:id` (full page) | Top nav | **Customers / Feedback** |
| 5 | Feedback | `#/feedback` | Customers sub-tab | — |
| 6 | Messages (inbox) | `#/messages/:threadId` | Top nav, notifications | **Inbox / Email** |
| 7 | Email (campaigns) | `#/email`, `#/email/:id` (sheet) | Messages sub-tab | All / Sent / Scheduled / Drafts |
| 8 | Analytics | `#/analytics` | Top nav, "Full analytics" | 7D/30D/90D/12M × All/Online/In store |
| 9 | Automations | `#/automations`, `#/automations/:id` (builder) | Top nav | **Automations / Integrations** |
| 10 | Integrations | `#/integrations` | Automations sub-tab | Category pills |
| 11 | Workspace (Kanban) | `#/workspace` | Dock icon (badge 11) | Board tabs: Spring Launch / Retail Plan |
| 12 | Help center | `#/help` | Dock icon | — |
| 13 | Settings | `#/settings/{profile,store,notifications,team,plan}` | Dock icon, avatar | Profile / Store / Notifications / Team / Plan & billing |

**Pattern worth copying:** related screens share one nav slot and switch with a **segmented sub-tab next to the page title** (Customers|Feedback, Inbox|Email, Automations|Integrations). That keeps the top nav down to 7 items.

---

## 4. Global app shell

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [■] Corbel Supply Co.     ( Dashboard  Orders 14  Products  … )   🔔 MR JO AP +2 (MR) │
│     Pro trial, 9 days left                                                 │
│                                                                            │
│ Page Title   ( Sub | Tab )                                 ( • 1,412 live now ) │
│ ┌──┐                                                                       │
│ │🔍│  ← floating dark dock (vertically centred, left)                      │
│ │▥¹¹│                                                                      │
│ │⚙ │          page content: KPI row → cards grid                          │
│ │? │                                                                       │
│ │──│                                                                       │
│ │✦ │                                                                       │
│ │☾ │                                                                       │
│ └──┘                                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour observed |
|---|---|
| **Brand block** (top-left) | Logo tile, workspace name, plan state ("Pro trial, 9 days left"). Click → Dashboard |
| **Top pill nav** | A floating capsule. The active item is a **solid dark pill**; inactive items are plain text. Badges are small rounded counters |
| **Notifications bell** | Red dot when unread. Opens a popover with "Mark all read" and typed rows (cart icon = order, warning = stock, chat = message, mail = campaign, bolt = automation), each with a relative time. Rows deep-link to the record |
| **Presence avatars** | `MR JO AP +2` overlapping circles show teammates online now |
| **Profile avatar** | Goes to Settings → Profile |
| **"live now" pill** | A dot plus a number that animates (odometer digits) every few seconds, e.g. 1,284 → 1,307 → 1,412. Gives a "live system" feeling |
| **Left dock** (dark capsule) | Search (⌘K) · Workspace (badge 11 = open cards) · Settings · Help · divider · ✦ "Unlock forecasting: upgrade" · ☾ theme toggle. The active item gets a lighter circle and a small dot |
| **⌘K / Ctrl+K palette** | Centred modal with a blurred backdrop. Empty state lists **Pages** ("Go to page"). Typing searches **Orders, Customers, Products**, grouped with a right-aligned meta column (e.g. "Paid, $234"). Arrow keys move, Enter opens, Esc closes |
| **Toasts** | Bottom-right, dark pill, auto-dismiss after ~3s, announced via `aria-live="polite"` |
| **Page header** | Large title (34px), optional segmented sub-tab beside it, right-side actions (Export, primary button) |

---

## 5. Design system: look and feel

### 5.1 Principles

1. **Glass over mesh.** The page background is a soft multi-colour radial mesh (sky blue, mint, coral). Cards are semi-transparent white with an inner 1px light rim and a long soft shadow.
2. **Monochrome first.** The default "Mono" palette is near-black on off-white. Colour is reserved for **status** (green up, red down, amber warning). The status colours mean the same thing in every palette.
3. **Pills everywhere.** Buttons, nav, segmented controls, chips and status badges are all fully rounded (999px).
4. **One inverted hero tile per row.** The first KPI tile is dark with white text, and the others are light. This guides the eye.
5. **Numbers are the heroes.** KPI values are large (26–34px). Deltas are small pills (`↑ 14.2%` on a green-soft background, `↓ −0.2 pt` on red-soft) followed by "vs last month".
6. **Quiet hover.** Cards lift slightly (shadow grows, border darkens). Buttons change brightness. Nothing jumps.

### 5.2 Token inventory (Corbel's, for reference; Nexora defines its own)

| Token group | Corbel values (light) | Notes |
|---|---|---|
| Font | Urbanist 400–700 | Nexora: we pick our own (e.g. Inter Tight / Plus Jakarta Sans / Urbanist, all free on Google Fonts) |
| Type scale | 11 · 12 · 12.5 · 13.5 · **14 base** · 15 · 17 · 20 · 22 · 26 · **34 display** | Tight, mostly 12–15px UI text |
| Radii | 8 (xs) · 14 (sm) · **22 (card)** · 28 (lg) · 999 (pill) | Big radii = friendly |
| Background | `#e6ecef` + 3 mesh blobs | Dark: `#0c1216` + dimmed mesh |
| Surfaces | glass `#ffffff80`, glass-2 `a8`, glass-3 `db`, float `#fbfcfd` | Layered translucency |
| Lines | ink at 9% / 16% alpha | Very low contrast borders |
| Shadow | inset 1px white rim + `0 24px 48px -30px` | Long, soft, offset downward |
| Status | up `#22735c`/soft, down `#b1412a`/soft, warn `#85580a`/soft | Same meaning in all palettes |
| Chart series | c1–c5 + 5-step heat scale + hatch pattern | Hatched bars = past/forecast, solid = current |
| Motion | `cubic-bezier(.2,.8,.2,1)` | Fast-out, gentle settle |
| Layout | dock 60px at x=20px, gutter `clamp(16px,1.6vw,28px)`, max app width 1840px | |
| Breakpoints | 1320 · 1180 · 1100 · 920 · 760 · 720 · 640 · **560** | Has a mobile bottom tab bar (`--tabbar-h`) |

### 5.3 Component inventory

| Component | Anatomy |
|---|---|
| **KPI tile** | label + ⓘ tooltip, big value, delta pill + "vs last month", optional micro-viz on the right (mini bars, sparkline, ring %, bar strip), dashed divider, underlined text link ("See orders") |
| **Card** | title (15px, 600) + optional ⓘ + subtitle on the right ("$300,000 so far this year"), tools on the right (segmented year toggle), body |
| **Segmented control** | Grey well, white selected thumb that **slides** between options |
| **Filter pills with counts** | `All 30 · Pending 4 · Paid 8 …`; the selected one is dark |
| **Status pill** | dot + label, tinted background |
| **Tag chip** | outlined pill; toggles in place (`✓ VIP` filled vs `+ New` outline) |
| **Avatar** | Initials in a soft circle (no photos needed) |
| **Data table** | Sticky header, sortable columns (arrow icon), row checkbox, avatar + name + sub-line, right-aligned numbers, status pill. Row hover highlight. Row click opens a sheet |
| **Bulk action bar** | Floating dark capsule at the bottom centre: "2 selected · Mark as packed · Mark as shipped · Clear" |
| **Side sheet** | Right-anchored floating panel (460px, 12px margin, rounded), blurred page behind, header with ×, scrollable body, **sticky footer** with secondary + primary actions |
| **Modal** | Centred (520px; "wide" variant for template pickers), title + ×, body, footer Cancel / Primary |
| **Popover menu** | Small rounded card with a heading ("Paywave") and icon rows; destructive row in red |
| **Stepper** | Numbered circles joined by a line; done = filled ✓, current = ring, future = outlined number; date + time under each |
| **Progress bar** | Thin rounded bar, green when healthy, amber when low, red-soft when empty |
| **Empty state** | Title + one-line hint ("No runs yet. Runs show here as customers enter the flow.") |
| **Toggle switch** | Pill switch, dark when on |

---

## 6. Theme: light/dark mode and colour palettes

| Control | Where | Effect |
|---|---|---|
| Theme toggle | Dock ☾/☀ button **and** Settings → Profile → Appearance → Light/Dark | Sets `<html data-theme="dark">`. Every token swaps: background becomes near-black, cards dark glass, text light. The "inverted hero" tiles flip, so in dark mode the KPI tiles become **light** on the dark page |
| Colour palette | Settings → Appearance → Colour: **Mono · Pastel · Ocean · Sage** | Sets `<html data-palette="ocean">`. Re-tints the primary colour, mesh blobs, KPI tile fills, gauge and chart series. Ocean = blues/teals; Sage = greens; Pastel = mixed pastels |
| Persistence | `localStorage['corbel:theme']` | An inline script in `<head>` applies the theme **before first paint**, so there's no flash |
| Live update | — | No reload. Charts and tiles recolour instantly because everything reads CSS variables |

**Nexora implementation:**
- `ThemeProvider` reads the user preference (`light | dark | system`) plus the palette.
- MUI v6 `cssVariables: true` with `colorSchemes: { light, dark }` maps everything to CSS variables.
- Palettes are extra variable sets toggled by `data-palette`.
- Preferences are stored per user **in the database** (so they follow the user across devices), and also cached in `localStorage` for the pre-paint script.

---

## 7. Screen-by-screen teardown (with test results)

Legend: ✅ = clicked and verified, with the observed result.

### 7.1 Dashboard (`#/dashboard`)

**Layout:** header row (Overview/Online/In store segmented · "October 2026, month to date" · Full analytics · **Export**) → 4 KPI tiles → Sales performance gauge + Revenue bar chart → Visits heatmap + Total visits donut.

| Widget | Content | Interaction tested |
|---|---|---|
| KPI: Active sales (dark hero) | $48,320 ↑14.2%, mini 3-bar viz | ✅ "See orders" → Orders |
| KPI: Revenue | $39,500 ↑7.6%, sparkline | ✅ "See analytics" → Analytics |
| KPI: Units sold | 3,842 ↑6.4%, ring "77%" | "See products" |
| KPI: Conversion rate | 4.8% ↓0.2pt, bar strip | "See funnel" |
| Sales performance | Semicircle gauge with tick marks, score **86/100 (+3)**, status "Ahead of plan" + explanation, "Improve your score" link | Hover shows the knob |
| Revenue (year) | 12 monthly bars: past months **hatched**, current month **solid gradient** and highlighted, future months **dashed outline = forecast**. Dotted "avg $30k" line. 2025/2026 toggle | ✅ Hovering a bar shows a dark tooltip: "Jun 2026 · Revenue $38,500 · Orders 542 · vs last year +27.5%" |
| Visits by time | Heatmap of 7 days × 4 time bands, 5-step legend (0 → 11k+) | Hover a cell for the value |
| Total visits | 214,860 ↑8.5%, donut 76% Website, legend rows with counts | Donut segments have labels (Website 162,400 (76%)) |
| Live now pill | Ticks every few seconds | ✅ Observed 1,284 → 1,490 |

### 7.2 Orders (`#/orders`)

**Layout:** 4 KPI tiles (Open orders 14 · To ship today 10 · Average order value $368.72 · Refunds this month $0.00) → status filter pills with counts → search ("Order number or customer") + channel pills (All channels / Online / In store) + **Export CSV** → table.

**Table columns:** ☐ · Order · Customer (avatar, name, city) · Placed (relative: "3 hr. ago", "yesterday") · Channel (icon + label) · Items · Total · Payment (Cash / Card / Apple Pay) · Status (dot pill). Sortable by Placed and Total. 30 rows.

| Action | Result |
|---|---|
| ✅ Tick row checkboxes | A floating **bulk bar** appears at the bottom: "N selected · Mark as packed · Mark as shipped · Clear" |
| ✅ Click a row | URL → `#/orders/10476`; **side sheet** opens with: status pill + placed date + channel · **5-step stepper** (Pending → Paid → Packed → Shipped → Delivered) with timestamps · items list (avatar initials, qty × price, line total) · subtotal / shipping / total · Ship to · Payment · customer mini-card (16 orders, $1,920 spent, "View customer") · **Activity log** (who did what, when). Footer: **Invoice** · Refund · primary **"Mark as <next status>"** |
| ✅ "Mark as shipped" | Stepper advances, timestamp stamped (Oct 31, 1:34 PM), status pill updates, the primary button changes to "Mark as delivered", and the Orders badge drops |
| ✅ "Invoice" | Downloads `corbel-invoice-10476.txt` (see §11) |

### 7.3 Products (`#/products`)

**Layout:** KPI tiles (Stock value at cost $17,414 · Low stock 2 · Out of stock 1 · Average margin 64.2% with progress bar) → search "name or SKU" + "16 products" + **Sort** (Best-selling · Price high→low · Price low→high · Stock lowest first · Name A→Z) + **Grid/Table** toggle + **Add product** → category pills (All, Kitchen, Table, Bath, Garden, Desk) + status pills (All, Active, Draft, Archived).

**Product card:** initials tile, optional status badge (● Low stock amber / ● Out of stock red), name, SKU, price + margin %, "260 in stock … reorder at 80", stock bar (green / amber / red-soft), ★ rating (reviews), "412 sold, 30 days".

| Action | Result |
|---|---|
| ✅ Add product | Modal: Name, Category (select), Status (Active, on sale now / Draft, not on sale), Price $, Unit cost $, Stock on hand (0), Reorder point (20), Description, **live Margin preview** ("Enter a price and a cost") |
| ✅ Click a card | `#/products/p5` sheet: description; Price (inline input, **"Press Enter to save"**), Unit cost, Margin ($25/unit); Stock "96 units on hand" with **− / + stepper**, "About 16 days of cover · Reorder point 30", **Restock +60** button; "Sales, last 30 days" sparkline with best-day callout; Status select (Active / Draft / Archived). Footer: Done |

### 7.4 Customers (`#/customers`) and customer profile (`#/customers/:id`)

**List:** segment pills (All · VIP 4 · Wholesale 2 · New 3 · Subscribers 7) · Export · **Add customer** → KPIs (Customers 14 · New this month 3 · Repeat rate 93% · Average lifetime value $1,788) → table card "All customers 14" with search + sort select (Highest spend …). Columns: Customer (avatar/name/email) · City · Channel · Orders · Lifetime spend · Last order · Tags.

**Add customer modal:** Full name or business, Email, City, Shops with us (Online/In store), Tag toggles (VIP, Wholesale, New, Subscriber).

**Customer profile (full page, not a sheet), the most CRM-relevant screen:**
- Back link "‹ All customers" · actions **Copy email** · **Send message**
- Identity card: avatar, name, email · phone · city, **Lifetime value $6,524 across 16 orders**
- KPI row: Orders 16 (2 in last 30 days) · Average order $408 · Last order "6 days ago, #10463 for $3,085"
- **Monthly spend** bar chart, 12 months
- **Order history** rows (id, date, items, status pill, total, ›) + "Plus 14 earlier orders"
- **About**: Customer since, Shops, **Tags** (toggle chips: ✓ VIP, ✓ Wholesale, + New, + Subscriber)
- **Notes**, "Only your team sees these": textarea + "Saved" state + Save note
- **Conversations**: linked message threads with preview and time

### 7.5 Feedback (`#/feedback`)

- **Share feedback form:** type segmented (Idea / Problem / Praise), 5-star rating, area select, message (0/600 counter), **Attach a screenshot** (PNG/JPG/WebP ≤ 10 MB), "Send feedback" (disabled until rating + area + message; the hint text says so).
- **Your feedback** list with status pills (Planned / In review / Shipped).
- **Top requests** voting board (Top / New): upvote counts (143, 128, 96 …), area · status · date.

### 7.6 Messages: unified inbox (`#/messages/:thread`)

Three panes:
1. **Thread list:** "Inbox · 2 unread", All/Unread/Done, search, rows with avatar + **channel badge** (website chat / email / Instagram), name, subject, preview, time, ☆ star, unread dot.
2. **Conversation:** header (name, linked **Order #10480** chip, channel, subject, ☆, ✉, **Mark done**), day separator, bubbles (customer = light on the left, team = dark on the right, with agent name + time), **quick-reply chips** (Ships today / Checking now / Thanks), composer "Write a reply…", hint "Enter to send, Shift+Enter for a new line".
3. **Customer context:** avatar, city, tag, Lifetime spend, Orders, Shops, Customer since, Contact (email, phone), Recent orders, "View customer".

| Action | Result |
|---|---|
| ✅ Click "Ships today" chip | Composer fills a **template with merge fields**: "Good news, Sofia: order #10480 ships today. I'll send tracking as soon as the carrier scans it." |
| ✅ Press Enter | Message appears as a dark bubble ("Mara 2:01 PM"), a **typing indicator (•••)** shows, then a simulated customer reply arrives |

### 7.7 Email campaigns (`#/email`)

- KPIs: Subscribers 18,760 (+412) · Avg open rate 48.8% · Avg click rate 8.4% · Email revenue 30d $21,870.
- Filters: All / Sent / Scheduled / Drafts, search, **New campaign**.
- Table: Campaign (name + preheader) · Status (● Scheduled / ○ Draft / ● Sent) · Audience (segment + size) · Date (🕒 scheduled time or "Sent Oct 29") · Opens % with bar · Clicks % with bar · Revenue.

| Action | Result |
|---|---|
| ✅ New campaign | Modal: Campaign name, Subject line, Preview text (optional), **Audience select with live counts** (All subscribers 18,760 · VIP 612 · New 940 · Bath buyers 3,480 · Waitlist 1,260) → Create draft |
| ✅ Click a sent campaign | Sheet: status + audience · **Preview with Desktop/Mobile toggle** (rendered email: header, hero, CTA, 3 product tiles, footer with Unsubscribe) · **Results funnel**: Delivered 940 → Opened 548 (58.3%) → Clicked 121 (12.9%) → Orders 36 → Revenue $2,310 · footer **Duplicate** / **Send test** |

### 7.8 Analytics (`#/analytics`)

- Controls: range **7D / 30D / 90D / 12M** × channel **All / Online / In store** · **"vs previous period" toggle** · **Export CSV**.
- 5 KPI tiles, each with a sparkline: Revenue $37,809 · Orders 541 · AOV $69.94 · Conversion 4.53% · Returning customers 38.7%.
- **Revenue over time**: smooth area line (this period) + dashed line (previous period), legend.
- **Online vs in store**: 66/34 split bar, per-channel revenue + delta + an **auto-generated insight sentence** ("Online grew faster this period: +7.6% against +1.0% for the shops").
- **Conversion funnel**: Visits → Product views → Add to cart → Checkout → Purchase, with counts, % and **drop-off % between steps** (the biggest drop is highlighted red).
- **Traffic sources** donut (Direct, Search, Social, Email, Referral).
- **Top products** ranked table with inline revenue bars.
- **When people buy**: Weekday/Hour toggle, bar chart with the busiest bar highlighted, footer stats (Weekdays 68% · Weekend 32% · Peak vs low 1.4×).

✅ Export CSV → `corbel-analytics-30d-all.csv` (file name reflects the active filters). Columns: Date, Revenue, Previous period date, Previous period revenue, Change. Toast: "Exported corbel-analytics-30d-all.csv".

### 7.9 Automations (`#/automations`). See §10 for the deep dive.

### 7.10 Integrations (`#/integrations`)

- Header card: "5 of 12 apps connected" + connected-app logo stack + progress bar.
- Category pills with counts: All 5/12 · Payments 1/1 · Point of sale 1/1 · Shipping 1/2 · Accounting 0/3 · Marketing 1/3 · Support 1/2 · search apps.
- App card: logo tile, name, category, description, "● Connected" pill, "⟳ Synced 33 min. ago" **or** "Not connected", and a **Manage ▾** or **Connect** button.

| Action | Result |
|---|---|
| ✅ Connect | Modal with **permission scopes** ("Ledgerly will be able to: read orders, refunds and payouts; read tax and currency settings; create entries in your books. You can disconnect at any time from Manage.") → **Connect Ledgerly** → animated **3-stage progress: Authorise → Syncing sales → Done** → toast "Ledgerly connected", counts update to 6/12 |
| ✅ Manage ▾ | Popover: **Sync now** · **Disconnect** (red) |

### 7.11 Workspace / Kanban (`#/workspace`)

- Board tabs: "Spring Launch 6" / "Retail Plan 5".
- Board header: goal ("Bath & garden collection — online and both shops."), due date + days left, card count, **"Show cards for" avatar filter**, **progress ring (25%, 2 of 8 done)**, **Add card**.
- Columns: To do · In progress · Review · Done, each with a count and "+".
- Card: tag pill (Copy / Buying / Photo / Design / Store / Ops), title, checklist progress ✓ 2/4 with bar, assignee avatar, due ("Due in 3 days"; **amber "Due tomorrow"** when close), comment count, "…" menu.

| Action | Result |
|---|---|
| ✅ Click a card | **Card details** sheet: Title, Column (select), Tag, Assignee, Due date, **Checklist** (checkboxes + add item), **Comments**, footer Delete card / Done |
| Drag a card | Pointer-based drag with a placeholder slot and an animated drop. Toast "Card moved to Done" |

### 7.12 Help center (`#/help`)

Search ("Try 'refund' or 'low stock'", 18 articles and 15 answers) → 6 category tiles (Getting started, Orders & shipping, Payments & payouts, Products & stock, Integrations, Account & billing) → Popular articles (with read time) → **FAQ accordion** → right rail: **Still stuck? Contact support** (response time, hours) + **System status** (All systems operational; Checkout 99.99%, Payments 99.97%, Point of sale 100%, Email 99.97% with 90-day uptime bars).

### 7.13 Settings (`#/settings/*`)

| Tab | Contents |
|---|---|
| Profile | Avatar card, Full name, Email, Role (read-only, "Only another owner can change this"), **Appearance**: Theme Light/Dark, Colour Mono/Pastel/Ocean/Sage ("Applies straight away, on this device") |
| Store | Store name, Currency select, Time zone select, Shops (address cards per location) |
| Notifications | "Email me about" toggles: New orders, Low stock, Customer messages, Weekly report (Mon 8 AM), Product news |
| Team | "5 of 10 seats used · 0 pending" + seat bar, member rows (avatar, name, email, **role select**: Owner / Store manager / Marketing / Fulfilment / Support), delete. ✅ **Invite teammate** modal: Email + Role (Admin / Store manager / Marketing / Fulfilment / Support / Viewer) → Send invite |
| Plan & billing | Current plan card (Pro trial, 9 days left, usage bar 21/30 days, included features, downgrade notice) + upgrade card (Corbel Plus $79/mo, features, **Upgrade to Plus**) + **Billing history** table (Invoice no., Date, Plan, Amount, Status, ✅ **Download**) |

---

## 8. Interaction pattern catalogue

| Pattern | Where | Rule to reuse in Nexora |
|---|---|---|
| **Deep-linked sheet** | Order, product, campaign | Every record has a URL; the sheet opens over the list; Esc/× returns to the list URL; the back button works |
| **Full-page record** | Customer profile | Use for rich records (Account, Contact, Deal) that have many sections |
| **Modal for create** | Add product/customer, new campaign/automation, invite | Short forms only (≤ 8 fields), primary button bottom-right, Cancel on the left |
| **Confirm destructive** | Delete automation | Modal that explains the consequence ("It stops straight away. Customers already in the flow won't get any more steps.") + red button |
| **Inline edit + Enter** | Product price, automation step names | Enter saves, Esc cancels, shows a "Saved" state |
| **Autosave** | Automation builder ("Changes save automatically", "Last edited: just now") | Debounced save + timestamp |
| **Primary action = next step** | Order sheet | The button label always describes the next state transition |
| **Bulk action bar** | Orders | Appears only when rows are selected; shows the count; Clear |
| **Segmented sub-nav** | Page title area | Groups 2 related screens under 1 nav item |
| **Filter pills with counts** | Orders, customers, integrations | Counts update live with data |
| **Toasts** | Everywhere | Past-tense confirmation ("Ledgerly connected"); include the file name for exports |
| **Staged progress** | Integration connect | Show the steps of a long operation |
| **Templates with merge fields** | Quick replies, automation templates | `{{first_name}}`, `{{order_number}}` |
| **Empty states** | Runs, paused list | Title + 1 helpful sentence + optional action |
| **Info ⓘ tooltips** | KPI and card titles | Explain how each metric is calculated |
| **Live counters** | Live now, badges | Real-time numbers (Nexora: via WebSocket/SSE) |
| **Keyboard first** | ⌘K, Enter/Shift+Enter, Esc | Document the shortcuts in the UI hints |

---

## 9. Charts and data visualisation catalogue

| Chart | Screen | Details to replicate (our own implementation) |
|---|---|---|
| Hatched / solid / dashed monthly bars | Dashboard revenue | Past = diagonal hatch, current = solid gradient + highlighted label, future = dashed outline (forecast), average reference line with a label pill, dark tooltip with 3 metrics + YoY delta |
| Semicircle gauge | Sales performance | Tick ring, gradient arc, knob at the value, centre score + delta pill |
| Heatmap | Visits by time | 7 × 4 rounded cells, 5-step sequential scale + legend |
| Donut with centre label | Total visits, traffic sources | Thick ring, gaps between segments, centre value, legend list with counts and % |
| Sparklines | KPI tiles | No axes, 1.5px stroke, end-dot |
| Ring % | Units sold tile | Small circular progress |
| Area + comparison line | Analytics revenue | Solid line + soft gradient fill = current, dashed = previous period |
| Split bar | Online vs in store | Two-segment bar + legend rows + insight sentence |
| Funnel bars | Analytics, email results | Horizontal bars, % of top, drop-off between steps, worst step highlighted red |
| Ranked table with inline bars | Top products | Rank, avatar, units, revenue, proportional bar |
| Highlight-max bar chart | When people buy | All bars grey, the max bar dark, Weekday/Hour toggle, summary stats footer |
| Monthly spend bars | Customer profile | 12 bars, current month dark |
| Uptime bars | System status | 90 thin bars |

**Nexora:** keep **Recharts** (already a dependency) with custom shapes (hatch `<pattern>`, rounded bars, custom tooltip) styled by our tokens. Load the `dataviz` skill when we build charts.

---

## 10. Automations deep dive

### 10.1 List view (`#/automations`)

- Segmented filter: **All / Active / Paused** + **New automation**.
- KPIs: **Active automations 4 of 5** · **Runs in 30 days 2,759 (↑11.8%)** · **Revenue influenced $26,554 (↑9.4%, from automated emails)** · **Conversions 374 (13.6% of runs ended in an order)**.
- Automation card: name, description, **on/off toggle**, a **mini flow strip** (icons for each step: ⚡ trigger, ✉ email, 🕒 wait, ⏷ condition, 🏷 tag, ✓ task), stats (Runs 30 days, Conversion %, Edited), status pill (● Active / ● Paused), "Open builder".

Seeded automations:

| Automation | Steps | Runs 30d | Conv. |
|---|---|---|---|
| Abandoned cart | ⚡ Cart abandoned 1h → ✉ "Still thinking it over?" → 🕒 Wait 1 day → ⏷ Still not purchased? → ✉ 10% code, expires 48h | 1,284 | 14.2% |
| Welcome series | ⚡ → ✉ → 🕒 → ✉ → 🕒 → ✉ (three emails over a week) | 940 | 8.7% |
| Low stock alert | ⚡ → ✓ task → 🏷 tag (ping fulfilment, raise a purchase task) | 23 | — |
| VIP thank-you (paused) | ⚡ 5th order → 🏷 → ✉ handwritten-style note | 0 | — |
| Review request | ⚡ Delivered → 🕒 1 week → ✉ | 512 | 21.4% |

### 10.2 Builder (`#/automations/:id`)

```
← All automations                                    Changes save automatically
┌───────────────────────────── canvas (dotted grid) ───────────┐ ┌─ Running ───── [on] ─┐
│            ┌──────────────────────────────┐                  │ │ Customers enter this │
│            │ ⚡ Trigger                    │ ✎               │ │ Runs 30d   Conversion │
│            │ Cart abandoned for 1 hour    │                  │ │ 1,284      14.2%      │
│            └──────────────┬───────────────┘                  │ │ Revenue    Last edit  │
│                          (+)  ← insert step here             │ │ $12,922    3 days ago │
│            ┌──────────────┴───────────────┐                  │ │ [▷ Test run] 🗑 Delete │
│            │ ✉ Email  Send "Still …"      │ ✎ 🗑            │ └──────────────────────┘
│            └──────────────┬───────────────┘                  │ ┌─ Recent runs ────────┐
│                          (+)                                 │ │ HS Hana Sato ● Done  │
│            ... Wait → Condition → Email ...                  │ │ TL Linen Rm ● In prog│
│                          (+)                                 │ │ OG Oliver   ● Waiting│
│                         [End]                                │ └──────────────────────┘
└──────────────────────────────────────────────────────────────┘
```

| Action | Result |
|---|---|
| ✅ "+" between or after steps | Popover "Add a step": **Wait** (pause before the next step) · **Email** (send a message from your templates) · **Condition** (only continue when this is true) · **Tag** (add a tag to the customer) · **Task** (assign a to-do to a teammate) |
| ✅ Pick "Task" | The step is inserted with its name field **auto-focused and selected**; it defaults to "Create a task for the team"; "Last edited" becomes "just now" |
| ✅ ✎ on a step | Inline rename only (the label becomes an input). **There's no real configuration** (no email picker, no wait duration control, no condition builder). This is the main mock-up limitation |
| ✅ 🗑 on a step | Removes it (the trigger can't be removed) |
| ✅ Running toggle | On: "Customers enter this flow". Off: "Paused — nobody enters" |
| ✅ Test run | Toast **"Test run passed"**; a new row appears at the top of Recent runs: "Mara Reyes (test) · just now · Passed" |
| ✅ Delete | Confirm modal: "Delete 'Abandoned cart'? It stops straight away. Customers already in the flow won't get any more steps." → Cancel / Delete automation |
| ✅ New automation | Wide modal: "Start from a template. You can change every step in the builder." Templates with mini flow strips: **Post-purchase thank-you**, **Win-back after 90 days**, **Back-in-stock alert**, **Birthday discount** (20% code the week of their birthday) + Name field → Create automation |
| Unknown id | "This automation doesn't exist. It may have been deleted. Pick another from the list." + "Show automations" |

Run statuses seen: **Completed · In progress · Waiting · Passed (test)**.

### 10.3 Nexora automation engine: what we build for real

**Concept:** *Workflow = Trigger → ordered Steps (with branching) → End.* Each record entering the flow creates a **Run**; each step execution creates a **Run step log**.

**Triggers (sales CRM):**

| Category | Triggers |
|---|---|
| Leads | Lead created · Lead source = X · Lead score crosses N · Lead unassigned for N hours |
| Deals | Deal created · Stage changed (from → to) · Deal stuck in stage > N days · Amount > X · Close date approaching · Deal won / lost |
| Contacts/Accounts | Contact created · Tag added/removed · Field changed · Birthday / anniversary · No activity for N days (win-back) |
| Activities | Task overdue · Meeting booked/completed · Email opened/clicked/replied · Form submitted |
| Invoices/Payments | Invoice sent · Invoice overdue by N days · Payment received |
| Schedule | Every day/week/month at time (cron) |
| Webhook / API | Inbound webhook from an external tool |

**Steps:**

| Step | Config |
|---|---|
| Wait | Duration (minutes/hours/days) or "until date field" or "until business hours" |
| Condition (If/Else branch) | Field / operator / value builder with AND/OR groups → **two branches** (Corbel only has "continue or stop") |
| Send email | Template picker, merge fields, from-user, tracking on/off |
| Send WhatsApp/SMS | Template (WhatsApp needs approved templates) |
| Create task | Title, assignee (owner / round-robin / specific user), due offset, priority |
| Update field | Set stage, owner, priority, custom field |
| Add/remove tag | Tag picker |
| Assign owner | Round-robin, by territory, by load |
| Notify | In-app + email to user/team/manager |
| Create deal / invoice | From template |
| Webhook (outbound) | URL, method, signed payload (HMAC) |
| Goal / Exit | End the run when the goal is met (e.g. deal won) |

**Must-haves Corbel lacks:**
1. Real step configuration panels (a right-side inspector when a node is selected).
2. Branching (If/Else) and exit goals.
3. **Re-entry rules** (once per record / every time / once per N days) and **suppression** (unsubscribed, do-not-contact).
4. Versioning: editing a live workflow creates a new version; in-flight runs finish on their old version.
5. A **test run against a chosen record** with a dry-run log ("would send email X to Y").
6. A per-run timeline (each step, timestamp, outcome, error), plus retry and cancel.
7. Rate limits and quiet hours.
8. Audit log for who created, edited, enabled or disabled a workflow.
9. Permissions: only Admin/Manager can enable workflows that email customers.

**Engine (server side):**
- Domain events (`deal.stage_changed`, …) are written to an `events` table in the same DB transaction as the change (outbox pattern).
- A worker matches events to active workflow triggers and creates `workflow_runs`.
- Steps are executed by a **Postgres-backed job queue (pg-boss)**, which needs no Redis on Hostinger. Wait steps become delayed jobs.
- Each step is idempotent (an idempotency key per run+step) with retries and exponential backoff. Failures land in a "Needs attention" list.
- Metrics (runs, conversions, revenue influenced) are computed from run logs + deal/invoice outcomes, attributed within an N-day window.

---

## 11. Downloads, exports and invoices

### 11.1 What Corbel does (tested)

| Download | Trigger | Actual output |
|---|---|---|
| Order invoice | Order sheet → **Invoice** | `corbel-invoice-<order>.txt`: a **plain-text** invoice built in the browser (store name, invoice no. + date, bill-to, items with qty × price, subtotal, shipping, total, payment method + status, thank-you line). **Not a PDF**, no tax breakdown, no logo |
| Billing invoice | Settings → Plan & billing → **Download** | `corbel-INV-2026-1009.txt`: plain text (billed to, date, item, amount, tax, total, paid-with) |
| Analytics CSV | Analytics → **Export CSV** | `corbel-analytics-30d-all.csv`: the file name encodes the filters; daily rows with previous-period comparison and % change |
| Orders CSV | Orders → **Export CSV** | CSV of the filtered table |
| Customers export | Customers → **Export** | CSV of customers |
| Dashboard export | Dashboard → **Export** | Report export |

All downloads are generated client-side: a `Blob` → object URL → hidden `<a download>`, followed by a toast "Exported <filename>".

### 11.2 Nexora invoice and quote system (real)

| Area | Design |
|---|---|
| Generation | **Server-side PDF** (`@react-pdf/renderer` or `pdfkit` in the API, or HTML → PDF via Playwright if we want pixel-perfect CSS). The browser never builds financial documents |
| Content | Company logo, legal name, address, tax ID; client bill-to/ship-to; invoice no., issue/due dates, PO ref; line items (description, qty, unit price, discount, tax rate); subtotal, tax breakdown (e.g. GST CGST/SGST/IGST if needed), total in words (optional), payment terms, bank/UPI details, notes, signature |
| Numbering | Per-company sequence with a prefix + year (`NX-INV-2026-0001`), generated in a DB transaction (no gaps or duplicates) |
| Lifecycle | Draft → Sent → Viewed → Partially paid → Paid / Overdue / Void. Status changes go to the audit log and fire automation triggers |
| Quotes | Quote → Accept → convert to Invoice (same line items) |
| Storage | The PDF is stored privately (Hostinger object storage or VPS disk outside the web root) and served via **short-lived signed URLs** after a permission check. Never a public folder |
| Download UX | "Download PDF" button → toast "Downloaded NX-INV-2026-0001.pdf"; also "Email to client" (from the server) and "Copy share link" (expiring) |
| Exports | CSV/XLSX exports run server-side, respect the user's data scope (own/team/all), are **logged in the audit trail**, and large exports run as background jobs with a notification when ready |

---

## 12. How data flows in Corbel

```
first load ──► seed JSON ──► localStorage["tend:v1"] (version, seededOn, staff, orders, products,
                                                   customers, threads, campaigns, automations, …)
                 │
UI action ──► in-memory store mutation ──► re-render the affected view(s) ──► persist to localStorage
                 │                                   │
                 └──► badge counts / KPIs recomputed  └──► toast via aria-live region
```

- **Single source of truth** in the browser; KPIs are derived from the records (e.g. "Open orders 14" is recomputed after marking shipped, and the nav badge updates).
- **Relative times** ("3 hr. ago") are computed from the seed date (`seededOn`), so the demo always looks fresh.
- **Simulated real time**: the live-now ticker is a timer; customer replies are a fake delayed response.
- **No backend, no auth, no multi-user.** Two people never see the same data.

**Nexora data flow (target):**

```
React UI ──(TanStack Query)──► REST/JSON API (Fastify) ──► service layer (RBAC + scope check)
   ▲                                        │                       │
   │ SSE/WebSocket (live counts,             │                       ├─► PostgreSQL (row-scoped queries)
   │ notifications, inbox)                   │                       ├─► outbox events ─► pg-boss workers
   └─────────────────────────────────────────┘                       │       (automations, emails, exports, PDFs)
                                                                     └─► audit_log (append-only)
```

---

## 13. Gaps: what Corbel fakes that we must build for real

| # | Corbel (mock) | Nexora (real) |
|---|---|---|
| 1 | No login; the user is hardcoded (Mara Reyes) | Email + password (Argon2id), httpOnly secure session cookies, optional TOTP 2FA, password reset, session/device list, invite-only sign-up |
| 2 | Roles are labels only | **RBAC enforced on the server** (Owner/Admin/Manager/Sales rep/Viewer) + **data scope** (own/team/all) on every query |
| 3 | `localStorage` data | PostgreSQL with migrations, backups, soft-delete, and an audit log for everything |
| 4 | Automation steps are rename-only | Full node configuration, branching, versioning, real job execution (§10.3) |
| 5 | `.txt` invoices | Server-generated PDF invoices and quotes with numbering, tax, branding (§11.2) |
| 6 | Fake live counter / fake replies | Real-time via SSE: new leads, inbox messages, notifications, presence |
| 7 | Integrations are animations | Real OAuth/API-key connectors (Gmail/Outlook, Google Calendar, WhatsApp Business, payment gateway), encrypted credential storage |
| 8 | Client-side exports | Server-side, permission-scoped, audited, rate-limited exports |
| 9 | No validation beyond required fields | Zod schemas shared by client and server, server is the authority |
| 10 | No security headers or CSRF | Helmet/CSP, CSRF tokens for cookie auth, rate limiting, input sanitisation, file-upload scanning and type checks |

---

## 14. Mapping Corbel → Nexora CRM

| Corbel screen | Nexora screen | Notes |
|---|---|---|
| Dashboard | **Sales dashboard** | KPIs: Pipeline value, Won this month, Win rate, Avg deal size. Gauge = **quota attainment** score. Bars = monthly revenue (hatched past / solid current / dashed forecast from the weighted pipeline). Heatmap = **activity by day/time** (calls, emails). Donut = **lead sources** |
| Orders | **Deals** (pipeline) + **Invoices** | Deals: **Kanban by stage** (from Workspace) + table view; deal sheet with a stage **stepper** (New → Contacted → Qualified → Proposal → Won/Lost), primary button "Move to <next stage>", activity log. Invoices: table + sheet + PDF |
| Products | **Products & services catalogue** | Price, cost, margin, used on quotes/invoices |
| Customers + profile | **Accounts & Contacts** + **Leads** | The profile page becomes the **360° client history**: lifetime value, deals, invoices, monthly revenue chart, tags, notes (team-only), conversations, **activity timeline**, files |
| Feedback | (Later) Internal feedback / NPS | Optional |
| Messages (inbox) | **Unified inbox** (email + WhatsApp) | Thread ↔ contact ↔ deal linking, quick-reply templates with merge fields, assign to a rep, Mark done |
| Email campaigns | **Sequences & campaigns** | Segments with live counts, desktop/mobile preview, results funnel |
| Analytics | **Reports** | Range × team/rep filters, vs previous period, funnel (Lead → Qualified → Proposal → Won), source donut, top reps leaderboard (instead of top products), "when deals close" chart, CSV/XLSX/PDF export |
| Automations + Integrations | **Automations** + **Integrations** | §10.3 |
| Workspace (Kanban) | **Tasks & projects board** | Columns, checklist, comments, assignee filter, due-soon amber |
| Help center | **Help** (later) | Can start as a static FAQ |
| Settings | **Settings** | Profile + Appearance, Company (currency, time zone, tax IDs, invoice prefix), Notifications, **Team & roles**, Pipeline stages, Custom fields, **Security** (2FA, sessions), Audit log, Billing (if SaaS later) |
| ⌘K palette | **Global search** | Search leads, contacts, accounts, deals, invoices, pages + quick actions ("New deal") |
| Notifications popover | **Notifications** | Typed, deep-linked, real-time |

**Existing Nexora screens and where they go:** Dashboard → Dashboard; Leads + Lead profile → Leads + Contact 360; Deals → Deals; Contacts → Contacts/Accounts; Tasks + Calendar → Tasks board + Calendar; Email → Inbox; Reports → Reports; Users → Settings › Team; Import → Settings › Data import; Audit log → Settings › Audit; Settings → Settings; InvoiceBuilder → Invoices; AssistantWidget → **removed** (or rebuilt later on a real backend).

---

## 15. Nexora target architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, React Router (real URLs, lazy-loaded routes) | Already in the repo |
| UI | **MUI v6 with `cssVariables` + our own token set**, restyled to the glass/pill language | Accessible inputs, date pickers, data grid for free |
| Motion | Framer Motion (counters, sheet slide, list stagger, shared-layout segmented thumb) | React-native equivalent of GSAP |
| Charts | Recharts with custom shapes | Already a dependency |
| Server state | TanStack Query (already in deps but unused; it becomes used) | Caching, optimistic updates |
| API | Fastify (already in `apps/api`) + Zod validation + OpenAPI | Fast, typed |
| DB | **PostgreSQL** on a Hostinger VPS + Drizzle ORM + migrations | Relational CRM data, row scoping |
| Jobs | pg-boss (Postgres queue) | Automations, emails, PDFs, exports without Redis |
| Auth | Own auth: Argon2id, session table, httpOnly/Secure/SameSite cookies, CSRF, TOTP, rate-limited login | No third-party lock-in; meets "no data leaks" |
| Files | Private storage + signed URLs | Invoices, attachments |
| Email | SMTP via Hostinger mail or a transactional provider | Invites, resets, automation emails |
| Deploy | Hostinger **VPS**: Nginx (TLS via Let's Encrypt) → API (systemd or PM2) + static web build; daily DB backups off-box | Hostinger shared hosting has no Postgres |

**Local prerequisite found during this audit:** this PC has **no Node.js installed** (`node`, `npm`, `pnpm` not found). Install Node 20 LTS + pnpm before Phase 0.

---

## 16. Phased build plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Clean-up** | Install Node/pnpm; split `screens.tsx`/`App.tsx` into feature folders; add React Router; remove dead code (unused zustand, the Supabase client, duplicate `packages/shared` permissions, the AssistantWidget mock); keep the app working on local seed data | Build + typecheck pass; same features, cleaner code |
| **1. Design system + shell** | Tokens (light/dark + 3–4 palettes), font, glass cards, mesh background, top pill nav + left dock, page header with segmented sub-tabs, ⌘K palette, toasts, notifications popover, sheet/modal/popover primitives, KPI tile, status pill, data table, bulk bar, stepper | Storybook-style showcase page; theme switch with no flash |
| **2. Screens redesign** | Dashboard → Leads/Contacts (+ 360° profile) → Deals (Kanban + sheet) → Tasks board → Inbox → Reports → Settings | Each screen reviewed and approved by the owner |
| **3. Backend + auth + DB (Hostinger)** | VPS setup, Postgres schema + migrations, auth, RBAC + scopes, replace local seed with the API, audit log | Two users with different roles see correctly scoped data |
| **4. Invoices & quotes** | Server PDF, numbering, lifecycle, email to client | Download real PDFs |
| **5. Automations** | Builder UI with inspector, triggers/steps from §10.3, pg-boss engine, run logs, test runs, templates | The "Deal stuck in stage" template works end-to-end |
| **6. Integrations & real time** | Email (IMAP/SMTP or Gmail/Outlook), Google Calendar, WhatsApp Business, SSE live updates | Inbox receives real email |
| **7. Hardening** | Security review, CSP, backups/restore drill, performance budget, accessibility pass, e2e tests (Playwright) | Ready for daily company use |

---

## 17. Open decisions for the owner

1. **Hostinger plan:** VPS (recommended, needed for PostgreSQL + background jobs) or Business/Cloud hosting (MySQL only, no background workers)?
2. **Brand:** product name stays "Nexora CRM"? Brand colour, and which palettes to offer (e.g. Mono + Ocean + one brand palette)?
3. **Font:** Urbanist (same feel as Corbel), or something distinct like Plus Jakarta Sans / Inter Tight?
4. **Currency and tax:** which currency, and do invoices need GST (CGST/SGST/IGST) or another tax format?
5. **Messaging channels:** email only first, or WhatsApp Business too (needs Meta business verification)?
6. **Roles:** confirm Owner / Admin / Manager / Sales rep / Viewer, and whether reps see only their own records.
7. **Which existing screens to drop or postpone:** Feedback, Help center and campaigns could come later.
