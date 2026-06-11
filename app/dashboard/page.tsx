"use client";

import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Countdown } from "@/components/Countdown";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Types ───────────────────────────────────────────────────────────────────

interface PlayerRow {
  id: string;
  username: string;
  totalPoints: number;
  heldPoints: number;
}

interface BidRow {
  id: string;
  username: string;
  amount: number;
  timestamp: string;
  status: string;
}

interface ItemRow {
  id: string;
  name: string;
  description: string | null;
  minBid: number;
  startTime: string;
  endTime: string;
  timerMode: string;
  antiSnipeMinutes: number | null;
  status: string;
  winnerUsername: string | null;
  winningBid: number | null;
  currentHighestBid: number | null;
  currentHighestBidder: string | null;
  history: BidRow[];
}

interface RoundRow {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: string;
  items: ItemRow[];
}

interface DashboardData {
  players: PlayerRow[];
  rounds: RoundRow[];
  standaloneItems: ItemRow[];
}

interface HistoryItem {
  id: string;
  name: string;
  description: string | null;
  minBid: number;
  status: string;
  winnerUsername: string | null;
  winningBid: number | null;
  bids?: BidRow[];
}

interface RoundHistory {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  items: HistoryItem[];
}

const statusColors: Record<string, "default" | "secondary" | "outline"> = {
  scheduled: "secondary",
  active: "default",
  ended: "outline",
};

// ── Main page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher, {
    refreshInterval: 3000,
  });

  if (isLoading || !data)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  // Only show active/scheduled rounds in the main view
  const visibleRounds = data.rounds.filter((r) => r.status !== "ended");

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Guild Bid</h1>
        <a href="/login" className="text-sm text-muted-foreground underline underline-offset-2">Login</a>
      </div>

      {/* Players */}
      <Card>
        <CardHeader><CardTitle>Players</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Username</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Held</th>
                <th className="pb-2 text-right">Available</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{p.username}</td>
                  <td className="py-2 pr-4 text-right">{p.totalPoints}</td>
                  <td className="py-2 pr-4 text-right text-amber-600">{p.heldPoints}</td>
                  <td className="py-2 text-right text-green-600">{p.totalPoints - p.heldPoints}</td>
                </tr>
              ))}
              {data.players.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No players yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Active / scheduled rounds */}
      {visibleRounds.map((round) => (
        <section key={round.id} className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold">{round.name}</h2>
            <Badge variant={statusColors[round.status]}>{round.status}</Badge>
            {round.status === "active" && (
              <span className="text-sm text-muted-foreground">ends <Countdown endTime={round.endTime} /></span>
            )}
            {round.status === "scheduled" && (
              <span className="text-sm text-muted-foreground">starts <Countdown endTime={round.startTime} /></span>
            )}
          </div>
          {round.description && <p className="text-sm text-muted-foreground -mt-1">{round.description}</p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {round.items.map((item) => <ItemCard key={item.id} item={item} />)}
            {round.items.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">No items in this round.</p>
            )}
          </div>
        </section>
      ))}

      {/* Standalone active/scheduled items */}
      {data.standaloneItems.filter((i) => i.status !== "ended").length > 0 && (
        <section className="space-y-3">
          {visibleRounds.length > 0 && (
            <h2 className="text-xl font-semibold text-muted-foreground">One-off</h2>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.standaloneItems
              .filter((i) => i.status !== "ended")
              .map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {visibleRounds.length === 0 &&
        data.standaloneItems.filter((i) => i.status !== "ended").length === 0 && (
          <p className="text-center text-muted-foreground">No active auctions right now.</p>
        )}

      <Separator />

      {/* Bidding History — full bid trails per item */}
      <CollapsibleHistorySection
        title="Bidding History"
        subtitle="all bids per item"
        detail
      />

      {/* History — winner summary with CSV export */}
      <CollapsibleHistorySection
        title="History"
        subtitle="winners only"
      />
    </div>
  );
}

// ── Collapsible section shared by both history views ────────────────────────

function buildUrl(from: string, to: string, detail: boolean) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (detail) params.set("detail", "true");
  const qs = params.toString();
  return `/api/history${qs ? `?${qs}` : ""}`;
}

function CollapsibleHistorySection({
  title,
  subtitle,
  detail = false,
}: {
  title: string;
  subtitle: string;
  detail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterActive, setFilterActive] = useState(false);

  const url = buildUrl(filterActive ? from : "", filterActive ? to : "", detail);
  const { data: rounds, isLoading, mutate } = useSWR<RoundHistory[]>(
    open ? url : null,
    fetcher
  );

  function applyFilter() {
    setFilterActive(true);
    mutate();
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    setFilterActive(false);
    setShowFilter(false);
  }

  return (
    <section className="space-y-3">
      {/* Section header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {open ? (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        )}
        <h2 className="text-xl font-semibold group-hover:underline underline-offset-2">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {filterActive ? "filtered" : !open ? `(${subtitle}, click to expand)` : subtitle}
        </span>
      </button>

      {open && (
        <div className="space-y-4 pl-6">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterActive && (
              <Button size="sm" variant="ghost" onClick={clearFilter} className="text-muted-foreground h-7 text-xs">
                ✕ Clear filter
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowFilter((v) => !v)}
            >
              {showFilter ? "Hide filter" : "Filter by date"}
            </Button>
          </div>

          {showFilter && (
            <div className="flex items-end gap-3 flex-wrap p-3 border rounded-md bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={applyFilter} disabled={!from && !to}>
                Apply
              </Button>
            </div>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!isLoading && rounds?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No ended rounds found{filterActive ? " in this date range" : ""}.
            </p>
          )}

          {rounds?.map((round) =>
            detail ? (
              <BiddingHistoryRound key={round.id} round={round} />
            ) : (
              <WinnerHistoryRound key={round.id} round={round} />
            )
          )}
        </div>
      )}
    </section>
  );
}

// ── Bidding History: full bid trails ────────────────────────────────────────

function BiddingHistoryRound({ round }: { round: RoundHistory }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{round.name}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {new Date(round.startTime).toLocaleDateString()} – {new Date(round.endTime).toLocaleDateString()}
          {" · "}{round.items.length} items
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {round.items.map((item) => (
            <div key={item.id} className="border rounded-md p-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium leading-tight">{item.name}</span>
                {item.winnerUsername ? (
                  <Badge className="bg-green-500 text-white text-xs shrink-0">Won</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs shrink-0">No winner</Badge>
                )}
              </div>

              {item.winnerUsername && (
                <p className="text-xs text-green-600 font-medium">
                  → {item.winnerUsername} · {item.winningBid} pts
                </p>
              )}

              {item.bids && item.bids.length > 0 ? (
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {item.bids.map((b) => (
                    <div key={b.id} className="flex justify-between text-xs">
                      <span
                        className={
                          b.status === "won"
                            ? "font-semibold text-green-600"
                            : b.status === "cancelled"
                            ? "line-through text-muted-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {b.username}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {b.amount} pts · {new Date(b.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No bids placed</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Winner History: summary table + CSV export ───────────────────────────────

function exportCsv(round: RoundHistory) {
  const wonItems = round.items.filter((i) => i.winnerUsername);
  const rows: string[][] = [
    ["Nickname", "Item", "Bid Point"],
    ...wonItems.map((item) => [item.winnerUsername!, item.name, String(item.winningBid)]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${round.name.replace(/[^a-z0-9]/gi, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WinnerHistoryRound({ round }: { round: RoundHistory }) {
  const wonItems = round.items.filter((i) => i.winnerUsername);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">{round.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(round.startTime).toLocaleDateString()} – {new Date(round.endTime).toLocaleDateString()}
              {" · "}{wonItems.length} items won
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportCsv(round)}
            disabled={wonItems.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {wonItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items were won in this round.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-1.5 pr-4">Nickname</th>
                <th className="pb-1.5 pr-4">Item</th>
                <th className="pb-1.5 text-right">Bid Point</th>
              </tr>
            </thead>
            <tbody>
              {wonItems.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 font-medium">{item.winnerUsername}</td>
                  <td className="py-1.5 pr-4 text-muted-foreground">{item.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{item.winningBid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Active item card ─────────────────────────────────────────────────────────

function ItemCard({ item }: { item: ItemRow }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{item.name}</CardTitle>
          <Badge variant={statusColors[item.status]}>{item.status}</Badge>
        </div>
        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {item.status === "active" && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ends in</span>
            <Countdown endTime={item.endTime} />
          </div>
        )}
        {item.status === "scheduled" && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Starts in</span>
            <Countdown endTime={item.startTime} />
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{item.currentHighestBid ? "Leading" : "Starting"}</span>
          <span className="font-medium">
            {item.currentHighestBid
              ? `${item.currentHighestBid} pts — ${item.currentHighestBidder}`
              : item.minBid > 0 ? `${item.minBid} pts (min)` : "—"}
          </span>
        </div>
        {item.timerMode === "antisnipe" && item.status === "active" && (
          <p className="text-xs text-muted-foreground">Anti-snipe: {item.antiSnipeMinutes}m extension</p>
        )}
        {item.history.length > 0 && (
          <>
            <Separator />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {item.history.map((b) => (
                <div key={b.id} className="flex justify-between text-xs">
                  <span className={b.status === "won" ? "font-semibold text-green-600" : b.status === "cancelled" ? "line-through text-muted-foreground" : ""}>
                    {b.username}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {b.amount} pts · {new Date(b.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
