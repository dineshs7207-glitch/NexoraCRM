# Solvik reference: the sales layout Nexora follows

Reference: https://demo.codeandchill.store/solvik/#/overview, a solar-sales CRM demo by the same maker as Corbel. It is a paid template, so we copy **structure, labels and behaviour only**, never its code, styles or text.

## Look

- Urbanist font; **dark by default**, over a soft blurred-photo background, with glass cards.
- **Lime accent** (`#c4ef4f`) with dark text on it; a dark ink pill for the active menu item in light mode; sky and coral as secondary colours.
- Large rounded cards (22px), pill controls, the same dock-on-the-left layout as Corbel.

## Screens and how Nexora maps them

| Solvik | What it shows | Nexora |
|---|---|---|
| **Overview** | Won this month, open pipeline, win rate; Revenue vs monthly target (6M/12M, "0 of 12 at target"); **Hot deals by weighted value**; **Team quota** (% of quarter, won, quota, days left, "Needs $X a day to land it"); **Stage mix**; Team leaderboard; **Today** (tasks with checkboxes and "Coming up"); Recent activity | `#/overview`, built the same way |
| **Pipeline** | Open pipeline, weighted forecast, closing this month; Board/List; owner filter; "Include won & lost"; stage columns Qualification, Proposal, Negotiation, Closing; deal drawer with stage stepper, amount, close date, owner, team, contact, Mark won/lost | `#/pipeline` with a **Deals \| Leads** switch, Board/List, an "Include won & lost" toggle and the deal panel |
| **Customers** | Customer directory: segment filter, last-contacted sort, grid/table; customer page with won/open totals, interaction history, schedule and stage funnel | `#/customers` (Accounts \| Contacts) and the 360° customer page |
| **Schedule** | Month/week calendar, Everyone or per-rep filter, Calls/Meetings/Tasks/Emails filters, today's agenda, overdue count | `#/schedule` (new) |
| **Finance** | Collected this month, outstanding, overdue; **Cash flow** (collected vs invoiced); **Aging** (0–30, 31–60, 61–90, 90+); invoices table | `#/finance` with cash flow and aging added, plus Invoices \| Quotes |
| **Growth** | New customers, average won deal, sales cycle; revenue by segment; lead sources; new customers per month; win-rate trend; top customers; rep performance | `#/growth`, with new-customer, win-rate-trend and top-customer cards added; the activity heatmap and lead sources moved here |
| **Projects** | Customer projects with status filter (Planning, In progress, In review, Done), progress, next step, due date and team | `#/projects` (new); a project starts automatically when a deal is won |
| Dock | Search, Create, Favourites, Today, Log a call, Compose, Copy link, Export, Settings, Theme | Search, **Create**, Tasks, **Automations**, Products, Settings, Theme |

Nexora keeps what Solvik doesn't have: **Leads** (inside Pipeline), the **Inbox** (icon in the top bar, a tab on phones), **Automations**, multi-currency invoicing with GST, and roles and permissions.

## Still to borrow later

- Revenue by customer segment (needs a segment field on accounts: Enterprise, Mid-market, SMB).
- A customer health score on customer cards.
- Favourites and "Log a call" quick actions in the dock.
- A schedule panel on the customer page.
