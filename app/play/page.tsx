"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Countdown } from "@/components/Countdown";
import { formatTime } from "@/lib/tz";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SessionUser { role: string; username: string; userId: string }

interface BidRow { id: string; username: string; amount: number; timestamp: string; status: string }

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
  winnerId: string | null;
  winningBid: number | null;
  winnerUsername: string | null;
  currentHighestBid: number | null;
  currentHighestBidder: string | null;
  currentHighestBidderId: string | null;
  history: BidRow[];
  roundName?: string | null;
}

interface RoundRow {
  id: string;
  name: string;
  status: string;
  endTime: string;
  items: ItemRow[];
}

interface DashboardData {
  players: { id: string; username: string; totalPoints: number; heldPoints: number }[];
  rounds: RoundRow[];
  standaloneItems: ItemRow[];
}

export default function PlayPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(({ user }) => {
      if (!user || user.role !== "player") router.push("/login");
      else setUser(user);
    });
  }, [router]);

  const { data: dashboard, mutate } = useSWR<DashboardData>("/api/dashboard", fetcher, {
    refreshInterval: 3000,
  });

  const me = dashboard?.players.find((p) => p.id === user?.userId);

  // Flatten all active items across rounds and standalone
  const activeItems: (ItemRow & { roundName?: string | null })[] = [
    ...(dashboard?.rounds.flatMap((r) =>
      r.items.filter((i) => i.status === "active").map((i) => ({ ...i, roundName: r.name }))
    ) ?? []),
    ...(dashboard?.standaloneItems.filter((i) => i.status === "active") ?? []),
  ];

  // Group by round for display
  const activeRounds = dashboard?.rounds.filter((r) =>
    r.items.some((i) => i.status === "active")
  ) ?? [];
  const activeStandalone = dashboard?.standaloneItems.filter((i) => i.status === "active") ?? [];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking session…</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Guild Bid</h1>
        <div className="flex items-center gap-4 text-sm">
          {me && (
            <span>
              <span className="text-muted-foreground">Points: </span>
              <strong>{me.totalPoints}</strong>
              {me.heldPoints > 0 && <span className="text-amber-600 ml-1">({me.heldPoints} held)</span>}
              <span className="text-green-600 ml-1">— {me.totalPoints - me.heldPoints} available</span>
            </span>
          )}
          <button onClick={logout} className="text-muted-foreground underline underline-offset-2">Logout</button>
        </div>
      </div>

      {activeItems.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No active auctions right now.</p>
      )}

      {/* Active rounds */}
      {activeRounds.map((round) => (
        <section key={round.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{round.name}</h2>
            <Badge>active</Badge>
            <span className="text-sm text-muted-foreground">ends <Countdown endTime={round.endTime} /></span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {round.items
              .filter((i) => i.status === "active")
              .map((item) => (
                <BidCard
                  key={item.id}
                  item={item}
                  userId={user.userId}
                  availablePoints={(me?.totalPoints ?? 0) - (me?.heldPoints ?? 0)}
                  heldOnThisItem={item.currentHighestBidderId === user.userId ? (item.currentHighestBid ?? 0) : 0}
                  onBid={mutate}
                />
              ))}
          </div>
        </section>
      ))}

      {/* Standalone active items */}
      {activeStandalone.length > 0 && (
        <section className="space-y-3">
          {activeRounds.length > 0 && (
            <h2 className="text-lg font-semibold text-muted-foreground">One-off</h2>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeStandalone.map((item) => (
              <BidCard
                key={item.id}
                item={item}
                userId={user.userId}
                availablePoints={(me?.totalPoints ?? 0) - (me?.heldPoints ?? 0)}
                heldOnThisItem={item.currentHighestBidderId === user.userId ? (item.currentHighestBid ?? 0) : 0}
                onBid={mutate}
              />
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <a href="/dashboard" className="underline underline-offset-2">Public dashboard</a>
      </p>
    </div>
  );
}

function BidCard({
  item, userId, availablePoints, heldOnThisItem, onBid,
}: {
  item: ItemRow;
  userId: string;
  availablePoints: number;
  heldOnThisItem: number;
  onBid: () => void;
}) {
  const [customAmount, setCustomAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const iAmLeading = item.currentHighestBidderId === userId;
  const effectiveAvailable = availablePoints + heldOnThisItem;

  async function placeBid(plusOne: boolean) {
    const amount = plusOne ? undefined : parseInt(customAmount, 10);
    if (!plusOne && (!amount || isNaN(amount))) return toast.error("Enter a valid amount");
    setBidding(true);
    const res = await fetch(`/api/items/${item.id}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plusOne ? { plusOne: true } : { amount }),
    });
    const data = await res.json();
    setBidding(false);
    if (!res.ok) return toast.error(data.error ?? "Bid failed");
    toast.success(`Bid placed: ${data.amount} pts`);
    setCustomAmount("");
    onBid();
  }

  return (
    <Card className={iAmLeading ? "ring-2 ring-green-500" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{item.name}</CardTitle>
          {iAmLeading && <Badge className="bg-green-500 text-white shrink-0">Leading</Badge>}
        </div>
        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ends in</span>
          <Countdown endTime={item.endTime} />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current highest</span>
          <span className="font-medium">
            {item.currentHighestBid
              ? `${item.currentHighestBid} pts — ${item.currentHighestBidder}`
              : item.minBid > 0 ? `${item.minBid} pts (min)` : "No bids yet"}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Your available</span>
          <span>{effectiveAvailable} pts</span>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => placeBid(true)} disabled={bidding} className="flex-1">+1</Button>
          <Input
            type="number" min={1} placeholder="Amount"
            value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && placeBid(false)}
            className="w-24 h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => placeBid(false)} disabled={bidding}>Bid</Button>
        </div>
        {item.timerMode === "antisnipe" && (
          <p className="text-xs text-muted-foreground">Anti-snipe: last-minute bids extend by {item.antiSnipeMinutes}m</p>
        )}
        {item.history.length > 0 && (
          <>
            <Separator />
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {item.history.slice().reverse().map((b) => (
                <div key={b.id} className="flex justify-between text-xs">
                  <span className={b.status === "cancelled" ? "line-through text-muted-foreground" : b.id === item.history[item.history.length - 1].id ? "font-semibold" : ""}>
                    {b.username}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {b.amount} pts · {formatTime(b.timestamp)}
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
