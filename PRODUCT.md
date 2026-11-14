# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Notex is a Tauri 2 application rendered with a WebView on Windows and Android. The visual language is custom (not Material, not Fluent); the layout and input affordances adapt per device: sidebar + mouse/keyboard on the laptop, bottom navigation + numeric keypad + large touch targets on the phone.

## Stack

Tauri 2 with a Rust core (SQLite via `rusqlite`, domain logic, sync client, embedded `axum` sync server) and a React 19 + TypeScript + Vite + Tailwind CSS v4 frontend. Sync between devices runs over Tailscale, with the Windows laptop acting as the always-owned server. No cloud account, no third-party backend.

## Users

One person: the father of the person who commissioned the app. A Spanish-speaking adult in Bolivia, not technical, who tracks household spending. He uses a Windows laptop at home and an Android phone everywhere else. He will not read documentation, configure servers, or troubleshoot sync. The app must be usable one-handed, in bright daylight, with reading glasses, and with no training.

## Product Purpose

Record personal expenses in a few seconds and understand where the money went. The app answers, at a glance: how much was spent today, this week, this month and this year; how that compares with the previous month; how much budget is left; and which categories are consuming it. Success means he opens the app without being asked, records a purchase before putting his phone away, and trusts the totals.

## Positioning

A private, local-first expense tracker that works with no internet and no account. Both devices hold a complete copy of the data; the laptop is the sync point over a private Tailscale network. Nothing is sent to a third party. The interface is in Spanish for Bolivia, uses bolivianos, and is designed around the speed of a single tap rather than around spreadsheets or bank integrations.

## Operating Context

- Expenses are recorded at the moment of purchase, usually on the phone; review and budgeting happen on the laptop.
- The laptop is a laptop: it is sometimes off, so sync is deferred, visible, and never blocks recording.
- Income is recorded too, so "what is left" is meaningful.
- Typical expenses: food, transport, household, utilities, health, education, leisure, clothing, other.
- Recurring payments: rent, electricity, water, internet, subscriptions. Amounts vary, so a recurring item asks for confirmation and allows editing the amount before posting.
- Cash and bank accounts are tracked separately; transfers between them are not expenses.
- Weeks start on Monday. Dates are shown as dd/mm/aaaa. Currency is BOB, formatted as `Bs 1.234,56`.
- Only one user: no shared budgets, no multiuser roles, no invitations.

## Capabilities and Constraints

Confirmed for the first release:

- Fast expense/income entry: amount, category, account, date, optional note.
- Dashboard totals for today, current week, current month and current year, plus previous-month comparison, daily average, budget remaining, category breakdown and recent movements.
- Movements list with search, filters, edit and delete with undo.
- Accounts: cash and bank only. Transfers between accounts. No credit cards, no digital wallets.
- Categories with color and icon; custom categories.
- Recurring templates with confirmation, amount editing and per-period skip.
- Monthly budgets per category, with 80% and 100% alerts.
- Reports: last 12 months, category breakdown, account balances.
- CSV export, automatic local backups.
- Optional PIN lock and a large-text mode.
- Offline-first sync with visible status, last-sync time and pending-change count.
- UI in Spanish (Bolivia).

Deliberately out of scope: credit cards, installments, digital wallets, receipt photos, multiuser, bank integrations, cloud accounts, web version, iOS.

Technical constraints:

- Windows installer is unsigned (SmartScreen warning expected); Android ships as a signed APK installed manually.
- The laptop may be asleep or off; the phone must remain fully usable.
- No floating-point money: amounts are stored as integer cents.
- Expense dates are calendar dates, never instants, so time zones cannot shift weekly or monthly totals.

## Brand Commitments

- Name: **Notex**.
- Binding visual reference: the LearnHarness repository (`amosblomqvist/learnharness`). The user explicitly asked for that style: near-black surfaces, thin borders, monospaced interface chrome, serif titles, small uppercase labels, no gradients, no drop shadows.
- Voice: plain Spanish, short labels, no financial jargon, no exclamation marks, no emoji in the interface.

## Evidence on Hand

None. There is no real transaction data, no user photography, no testimonials and no brand assets beyond the name. Future work must not fabricate financial figures, testimonials or usage claims; demo data must be clearly fictional and removable.

## Product Principles

1. **Recording beats organizing.** The add flow is the product; every other screen exists to make the next entry faster or more trustworthy.
2. **The total must be explainable.** Every number on the dashboard can be traced to the movements that compose it.
3. **Offline is the normal state.** Sync is an enhancement that reports its status, never a gate.
4. **No surprises.** Recurring charges ask before posting; destructive actions are undoable; the app never silently changes an amount.
5. **Built for one pair of eyes.** Large type, high contrast, one clear primary action per screen, Spanish labels written for a non-accountant.

## Accessibility & Inclusion

The primary user is an older adult. The app must keep body text at 16 px or larger, amounts at 18–20 px, a minimum 4.5:1 contrast ratio for text, touch targets of at least 44×44 px, and a large-text setting that scales the interface without breaking layouts. All actions must be reachable without hover. The interface is Spanish-only for now, but strings live in one place so a second language can be added later.
