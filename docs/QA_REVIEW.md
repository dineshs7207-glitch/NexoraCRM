# QA review: layout, phone view and motion

Tested on 31 Oct 2026 as QA and developer together. Every screen was checked at three widths, **390px (phone)**, **900px (tablet)** and **1280px (laptop)**. Each width got an automated check for anything overflowing the screen, button text spilling out, and pages that scroll sideways, plus a visual pass.

## Issues found and fixed

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | All text boxes | Fixed height; long text was hidden | New auto-growing text box (grows with content, then scrolls). The inbox composer works like WhatsApp: starts one line high and grows up to 6 lines. On phones, Enter adds a new line and the send button sends |
| 2 | Tasks ring, KPI rings | "50%" sat outside the circle | Small charts were being stretched to full width; now fixed-size, with text scaled to the ring |
| 3 | Sales activity heatmap | Cells could not be clicked | Cells are buttons; clicking opens the list of activities in that time slot, each linking to its deal, lead or customer. Moved to Growth |
| 4 | Customer page, inbox side panel | Phone number and website cut off or overlapping "Lifetime value" | Record headers wrap; contact details get a full row; long values break instead of clipping |
| 5 | Buttons | Labels could spill out on narrow screens | Buttons grow to fit their text and never exceed their container |
| 6 | Deal panel stepper | Stage names ran together on phones ("ContactedQualifiedProposa…") | Each step keeps its width; the stepper scrolls sideways if needed |
| 7 | Revenue chart | Month labels ran together on phones ("AugSept"); the average label covered the forecast bars | Narrow charts use month initials; the target label sits above the line |
| 8 | Inbox (desktop at ~900px) | Customer panel dropped under the chat | Hidden at that width, as intended |
| 9 | Automation builder | Long trigger names overflowed the step card | Names wrap |
| 10 | Spacing | Cards, tables, panels and forms felt cramped | More padding in cards, tables, panels and forms; KPI footers line up across a row |
| 11 | Inbox | Crash when opening a conversation (effect returned a value) | Fixed |

## Phone view (≤ 760px), rebuilt

- **Bottom tab bar**: Overview, Pipeline, Schedule, Inbox and More. "More" opens a sheet with the remaining pages and the theme switch. The top bar is a slim sticky header with search, notifications and your profile.
- **Tables become cards**: each row shows its main field as a title and the rest as label and value pairs.
- **Kanban on phones**: Pipeline and Tasks show stage chips; you pick a stage and see its cards. A **Move** button on each card replaces drag and drop, which doesn't work on touch.
- **Inbox**: list first; tap a conversation to open it full screen with a back button, like a chat app.
- **Panels and dialogs** slide up from the bottom with a grab handle and full-width buttons.
- **KPI tiles** in two columns. Text fields use a 16px font so iPhones don't zoom in.
- **Invoice line items** stack into cards.

## Motion and loading

- **Page changes**: content fades and rises in, with cards following one after another.
- **Top menu**: the highlight slides to the active item.
- **Light and dark**: a circular reveal from where you click, or a smooth colour fade in browsers that don't support it.
- **Panels and dialogs**: animate both in and out; page scroll is locked while one is open.
- **Buttons**: lift on hover and press in on click; chips and menu items respond to taps.
- **Loading**: a branded splash on first load and shimmering placeholders while a screen loads. Every screen is fetched in the background after the first one, so later switches are instant.
- **Reduced motion**: if the device asks for less motion, animations are turned off.

## How to re-run the checks

Load each route inside a 390px-wide iframe (and again at 900px and 1280px), then flag any element whose right edge passes the viewport and any button whose text is wider than the button. Scrolling areas (tables, chips, the calendar) are allowed to scroll. All screens passed at all three widths.
