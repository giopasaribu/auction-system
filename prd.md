# Product Requirements Document: Guild Bid System

**Version:** 1.0
**Status:** Final draft
**Last updated:** 11 June 2026

---

## 1. Overview

A web-based auction system for distributing guild items (loot, rewards, materials) among guild members using a points-based bidding model. Points are awarded by an admin based on a member's activeness in guild activities and function as the bidding currency. Members bid on multiple items simultaneously; the highest bidder when an item's timer ends wins and permanently spends the points.

The system assumes honest players who log in as themselves. It is built for trust, not adversarial security — login is lightweight (name selection from a dropdown, no per-player passwords).

---

## 2. Goals & Non-Goals

### Goals
- Let an admin manage players, points, and items with minimal friction.
- Let players bid on multiple items concurrently using a held-points model.
- Make point balances, held points, bid history, and results transparent on a public dashboard.
- Persist all state across refreshes and restarts.

### Non-Goals
- No anti-cheat, impersonation prevention, or per-player authentication beyond name selection.
- No in-game integration (manual point entry by admin).
- No payment, real money, or external currency.
- No proxy/auto-bidding (e.g. "max bid" agents) in v1.

---

## 3. User Roles

| Role | Authentication | Capabilities |
|------|---------------|-------------|
| Admin | Select "Admin" from dropdown + password | Manage players, points, items, auction timing |
| Player | Select own username from dropdown + click login | View points, place bids, view history & results |

---

## 4. Core Concepts

**Points** — A renewable currency awarded by the admin to reflect guild activeness. Spent permanently when a bid is won. Admin can reset, edit, or remove a player's points at any time.

**Available points** — Points a player can currently use to bid: `Total points − Held points`.

**Held points** — Points locked because the player is the current highest bidder on one or more items. Held points cannot be used elsewhere. Released the instant the player is outbid (or when their bid is cancelled).

**Auction (per item)** — Each item is an independent auction with its own start time, end time, and optional minimum bid. Multiple auctions run concurrently. Highest bid at end time wins.

---

## 5. Functional Requirements

### 5.1 Admin

| ID | Requirement |
|----|-------------|
| A-1 | Admin logs in by selecting "Admin" from a dropdown and entering a password. |
| A-2 | Admin can add a player (username). |
| A-3 | Admin can set, edit, reset, or remove a player's point total at any time. |
| A-4 | Admin can add an item for bidding: name, optional description, optional minimum bid. |
| A-5 | Admin can set the start time and end time for each item's auction. |
| A-6 | Admin can choose a timer mode per item: hard cutoff (default) or anti-snipe. When anti-snipe is enabled, admin sets an extension window (X minutes). |
| A-7 | Admin actions take effect immediately and persist. |

### 5.2 Player

| ID | Requirement |
|----|-------------|
| P-1 | Player logs in by selecting their username from a dropdown and clicking login. |
| P-2 | Player can bid on an item using a "+1 point" button — bids exactly 1 point above the current highest bid. |
| P-3 | Player can bid on an item by inputting a specific point amount (must be higher than the current highest bid, and ≥ minimum bid). |
| P-4 | Player can view their own point total and available (non-held) points. |
| P-5 | A player cannot place a bid that exceeds their available points. The bid is rejected if available points are insufficient. |
| P-6 | A player can hold bids on multiple items at once, as long as total held points stay within their total points. |
| P-7 | When a player is outbid on an item, their held points for that item are released immediately and become available again. |
| P-8 | A player who is already the current highest bidder on an item **may bid again** ("+1" raises their own bid by 1 and locks 1 additional point). No self-bid guard — this is intended. |

### 5.3 Bidding rules

| ID | Requirement |
|----|-------------|
| B-1 | A new bid must be strictly greater than the current highest bid. |
| B-2 | **Minimum bid** is an optional per-item field. If unset or `0`: the first bid on an empty item via "+1" equals `1`. If set to `N`: the first bid on an empty item equals `N`, and any bid must be `≥ N`. |
| B-3 | After the first bid, the "+1" button always bids exactly 1 above the current highest bid (including when the current highest is the player's own bid — see P-8). |
| B-4 | The bid amount locked against a player's available points equals the full bid amount they are now leading with (not just the +1 delta). |

### 5.4 Auction lifecycle

| ID | Requirement |
|----|-------------|
| L-1 | Bidding on an item is only allowed between its start and end time. |
| L-2 | When an item's end time is reached, the highest bidder wins. |
| L-3 | The winner's points are permanently deducted by the winning bid amount. |
| L-4 | If no bids were placed, the item ends with no winner (admin may relist). |
| L-5 | Held points convert to a permanent deduction only at win; before that they are reservations, not spends. |

### 5.5 Timer modes

| ID | Requirement |
|----|-------------|
| T-1 | **Hard cutoff (default):** the auction ends exactly at end time. Any bid at or after end time is rejected. |
| T-2 | **Anti-snipe (optional):** if enabled, a valid bid placed within the final X minutes extends the end time to `now + X minutes`. X is the admin-configured extension window. |
| T-3 | Anti-snipe can extend repeatedly — each qualifying late bid pushes the end time out again by the same rule. |

### 5.6 Admin point reduction (held-point conflict)

| ID | Requirement |
|----|-------------|
| R-1 | If an admin reduces a player's total points below the player's currently held points, every item where that player is the current highest bidder has that player's leading bid **cancelled**. |
| R-2 | Each affected item reverts immediately to **no-bid state** — it does NOT fall back to the previous bidder. (Chosen for simplicity.) |
| R-3 | The cancelled player's held points for those items are released. The item can receive fresh bids (subject to minimum bid) until its end time. |

### 5.7 Dashboard

| ID | Requirement |
|----|-------------|
| D-1 | Dashboard shows each player's username. |
| D-2 | Dashboard shows each player's point total. |
| D-3 | Dashboard shows each player's currently held points (sum across all items they lead). |
| D-4 | Dashboard reflects bid changes in near-real-time. |
| D-5 | **Public bid history** is shown per item: bidder username, bid amount, timestamp, in order. |
| D-6 | **Public results** for ended items: winning player and final price are displayed. |

---

## 6. Worked Examples & Edge Cases

1. **Self-raise via "+1".** Player A leads item X at 5 points (5 held). A clicks "+1" → A now leads at 6, with 6 points held. Each click raises price and lock by 1. This is intended (P-8).
2. **Minimum bid on empty item.** Item Y has min bid 10. First bidder's "+1" places a bid of 10, not 1. A manual bid below 10 is rejected.
3. **Outbid release.** A leads item X at 6 (6 held). B bids 7. A's 6 held points are released immediately and become available for A to use elsewhere; B now holds 7.
4. **Shared points across items.** Player with 20 total points leading three items at 5, 5, and 5 has 15 held and 5 available. A bid requiring more than 5 available is rejected.
5. **Admin point slash.** Player C has 20 points, leading item X at 12 (12 held). Admin lowers C to 8. Item X's leading bid by C is cancelled; X reverts to no-bid state; C's hold is released. X stays open for new bids until end time.
6. **Anti-snipe extension.** Item Z ends at 20:00 with anti-snipe X = 2 min. A bid at 19:59 extends end to 20:01. Another bid at 20:00:30 extends to 20:02:30. And so on.
7. **Simultaneous bids.** Two bids landing together are ordered server-side; the later-processed valid bid takes the lead and the earlier leader's points are released. Processing is atomic to prevent double-spend.
8. **Late bid, hard cutoff.** A bid submitted at or after end time (even by milliseconds) is rejected. Server clock is authoritative.

---

## 7. Data Model (suggested)

**Player**: `id`, `username`, `totalPoints`

**Item**: `id`, `name`, `description`, `minBid` (nullable / 0), `startTime`, `endTime`, `timerMode` (`hard` | `antisnipe`), `antiSnipeMinutes` (nullable), `status` (scheduled / active / ended), `winnerId`, `winningBid`

**Bid**: `id`, `itemId`, `playerId`, `amount`, `timestamp`, `isCurrentHighest`, `status` (active / outbid / cancelled / won)

*Held points are derived: for a player, sum the `amount` of all bids where `isCurrentHighest = true`, `status = active`, and the item is still active.*

---

## 8. Technical Notes

- **Persistence required** — All state survives refresh and server restart. Use a real datastore (SQLite/Postgres/etc.), not in-memory only.
- **Server-authoritative timing** — Auction open/close, anti-snipe extension, and bid acceptance are all decided by the server clock. The client only displays countdowns.
- **Atomic bid transactions** — Place-bid must validate available points, reassign the lead, and release the previous leader's hold in a single transaction to avoid race conditions and double-spend.
- **Atomic point-slash handling** — Reducing a player's points below held must cancel leads and release holds in one transaction.
- **Multi-device** — Each player uses their own device; a live-updating dashboard (polling or websockets) keeps everyone in sync.
- **Login** — Lightweight by design. Admin has a password; players self-select by name. No session security beyond this in v1.

---

## 9. Resolved Decisions (changelog from draft)

1. Self-bidding by the current leader is **allowed** — "+1" raises own bid and locks +1 point.
2. Admin point reduction below held → cancel leader's bids; items revert to **no-bid state** (no fallback to previous bidder).
3. Minimum bid is **optional per item**; 0/unset means first "+1" = 1, otherwise first bid = the minimum.
4. Bid history is **public**, shown per item.
5. Auction results (winner + final price) are **public** on the dashboard.
6. Two timer modes: **hard cutoff** (default) and **anti-snipe** (bid within final X min extends end to now + X).
