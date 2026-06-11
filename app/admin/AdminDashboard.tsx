"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Countdown } from "@/components/Countdown";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PlayerRow {
  id: string;
  username: string;
  totalPoints: number;
  heldPoints: number;
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
  roundId: string | null;
  roundName: string | null;
  timeOverride: boolean;
  winnerId: string | null;
  winningBid: number | null;
  winnerUsername: string | null;
  currentHighestBid: number | null;
  currentHighestBidder: string | null;
}

const statusColors: Record<string, "default" | "secondary" | "outline"> = {
  scheduled: "secondary",
  active: "default",
  ended: "outline",
};

export default function AdminDashboard() {
  const router = useRouter();
  const { data: players, mutate: mutatePlayers } = useSWR<PlayerRow[]>("/api/players", fetcher, {
    refreshInterval: 5000,
  });
  const { data: rounds, mutate: mutateRounds } = useSWR<RoundRow[]>("/api/rounds", fetcher, {
    refreshInterval: 5000,
  });
  const { data: items, mutate: mutateItems } = useSWR<ItemRow[]>("/api/items", fetcher, {
    refreshInterval: 5000,
  });

  const standaloneItems = items?.filter((i) => !i.roundId && i.status !== "ended") ?? [];
  const visibleRounds = rounds?.filter((r) => r.status !== "ended") ?? [];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function refreshAll() {
    mutateRounds();
    mutateItems();
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <a href="/dashboard" className="underline underline-offset-2">Dashboard</a>
          <button onClick={logout} className="underline underline-offset-2">Logout</button>
        </div>
      </div>

      {/* Players */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Players</CardTitle>
          <div className="flex gap-2">
            <ImportPlayersButton onImported={mutatePlayers} />
            <AddPlayerDialog onAdded={mutatePlayers} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {players?.map((p) => (
            <PlayerRow key={p.id} player={p} onUpdated={mutatePlayers} />
          ))}
          {players?.length === 0 && <p className="text-sm text-muted-foreground">No players yet.</p>}
        </CardContent>
      </Card>

      {/* Auction Rounds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Auction Rounds</CardTitle>
          <AddRoundDialog onAdded={mutateRounds} />
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleRounds.map((round) => (
            <RoundSection
              key={round.id}
              round={round}
              onUpdated={refreshAll}
            />
          ))}
          {visibleRounds.length === 0 && (
            <p className="text-sm text-muted-foreground">No rounds yet. Create a round to batch items together.</p>
          )}
        </CardContent>
      </Card>

      {/* Standalone items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>One-off Items</CardTitle>
          <AddItemDialog rounds={[]} onAdded={refreshAll} standalone />
        </CardHeader>
        <CardContent className="space-y-2">
          {standaloneItems.map((item) => (
            <ItemRow key={item.id} item={item} onUpdated={refreshAll} />
          ))}
          {standaloneItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No standalone items.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Import players button ───────────────────────────────────────────────────

function ImportPlayersButton({ onImported }: { onImported: () => void }) {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await fetch("/api/import", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) return toast.error(data.error ?? "Import failed");

    const { created, updated, skipped, errors } = data;
    toast.success(`Import done — ${created} created, ${updated} updated, ${skipped} skipped`);
    if (errors?.length) {
      errors.slice(0, 3).forEach((e: string) => toast.error(e));
    }
    onImported();
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={loading}>
      {loading ? "Importing…" : "Import from Spreadsheet"}
    </Button>
  );
}

// ── Import items button ─────────────────────────────────────────────────────

function ImportItemsButton({ roundId, onImported }: { roundId: string; onImported: () => void }) {
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!confirm("Import all items from the spreadsheet into this round? Existing items are not removed.")) return;
    setLoading(true);
    const res = await fetch("/api/import/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.error ?? "Import failed");
    toast.success(`Imported ${data.created} items into "${data.roundName}"${data.skipped ? ` (${data.skipped} skipped)` : ""}`);
    onImported();
  }

  return (
    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={run} disabled={loading}>
      {loading ? "Importing…" : "Import Items"}
    </Button>
  );
}

// ── Player row ──────────────────────────────────────────────────────────────

function PlayerRow({ player, onUpdated }: { player: PlayerRow; onUpdated: () => void }) {
  const [editPoints, setEditPoints] = useState(String(player.totalPoints));
  const [saving, setSaving] = useState(false);

  async function savePoints() {
    const val = parseInt(editPoints, 10);
    if (isNaN(val) || val < 0) return toast.error("Invalid points");
    setSaving(true);
    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalPoints: val }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); return toast.error(d.error ?? "Failed"); }
    toast.success("Points updated");
    onUpdated();
  }

  async function deletePlayer() {
    if (!confirm(`Remove ${player.username}?`)) return;
    await fetch(`/api/players/${player.id}`, { method: "DELETE" });
    toast.success("Player removed");
    onUpdated();
  }

  return (
    <div className="flex items-center gap-3 text-sm flex-wrap">
      <span className="font-medium w-28 truncate">{player.username}</span>
      <span className="text-xs text-muted-foreground">
        held: <span className="text-amber-600">{player.heldPoints}</span>
      </span>
      <Input type="number" min={0} value={editPoints}
        onChange={(e) => setEditPoints(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && savePoints()}
        className="w-24 h-7 text-sm" />
      <Button size="sm" className="h-7" onClick={savePoints} disabled={saving}>Set</Button>
      <Button size="sm" variant="destructive" className="h-7" onClick={deletePlayer}>Remove</Button>
    </div>
  );
}

// ── Round section ───────────────────────────────────────────────────────────

function RoundSection({ round, onUpdated }: { round: RoundRow; onUpdated: () => void }) {
  const [editOpen, setEditOpen] = useState(false);

  async function deleteRound() {
    if (!confirm(`Delete round "${round.name}"? Items will become standalone.`)) return;
    await fetch(`/api/rounds/${round.id}`, { method: "DELETE" });
    toast.success("Round deleted");
    onUpdated();
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      {/* Round header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{round.name}</span>
          <Badge variant={statusColors[round.status]}>{round.status}</Badge>
          {round.description && (
            <span className="text-xs text-muted-foreground">{round.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {round.status === "active" && (
            <span>Ends: <Countdown endTime={round.endTime} /></span>
          )}
          {round.status === "scheduled" && (
            <span>Starts: <Countdown endTime={round.startTime} /></span>
          )}
          {round.status !== "ended" && (
            <>
              <EditRoundDialog
                round={round}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdated={onUpdated}
              />
              <ImportItemsButton roundId={round.id} onImported={onUpdated} />
              <AddItemDialog rounds={[round]} defaultRoundId={round.id} onAdded={onUpdated} />
              <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={deleteRound}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Items in this round */}
      <div className="space-y-1.5 pl-2 border-l-2 border-muted">
        {round.items.length === 0 && (
          <p className="text-xs text-muted-foreground">No items in this round yet.</p>
        )}
        {round.items.map((item) => (
          <ItemRow key={item.id} item={item} onUpdated={onUpdated} inRound />
        ))}
      </div>
    </div>
  );
}

// ── Item row ────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onUpdated,
  inRound = false,
}: {
  item: ItemRow;
  onUpdated: () => void;
  inRound?: boolean;
}) {
  async function deleteItem() {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    toast.success("Item deleted");
    onUpdated();
  }

  return (
    <div className="flex items-center justify-between text-sm flex-wrap gap-x-4 gap-y-1 py-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{item.name}</span>
        <Badge variant={statusColors[item.status]} className="text-xs">{item.status}</Badge>
        {item.timeOverride && inRound && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">custom time</Badge>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {item.status === "active" && <span>Ends: <Countdown endTime={item.endTime} /></span>}
        {item.minBid > 0 && <span>Min: {item.minBid}</span>}
        {item.currentHighestBid && (
          <span className="text-foreground">{item.currentHighestBid} pts — {item.currentHighestBidder}</span>
        )}
        {item.status === "ended" && item.winnerUsername && (
          <span className="text-green-600">→ {item.winnerUsername} ({item.winningBid} pts)</span>
        )}
        {item.status !== "ended" && (
          <Button size="sm" variant="destructive" className="h-5 text-xs px-2" onClick={deleteItem}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Add player dialog ───────────────────────────────────────────────────────

function AddPlayerDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");

  async function submit() {
    if (!username.trim()) return toast.error("Username required");
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Player added");
    setUsername(""); setOpen(false); onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add Player</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Player</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="GuildMember" />
          </div>
          <Button className="w-full" onClick={submit}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add round dialog ────────────────────────────────────────────────────────

function AddRoundDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function toLocal(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function prefill() {
    const now = new Date();
    setStartTime(toLocal(now));
    setEndTime(toLocal(new Date(now.getTime() + 60 * 60 * 1000)));
  }

  async function submit() {
    if (!name.trim()) return toast.error("Name required");
    if (!startTime || !endTime) return toast.error("Set start and end time");
    const res = await fetch("/api/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      }),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Round created");
    setName(""); setDescription(""); setStartTime(""); setEndTime("");
    setOpen(false); onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) prefill(); }}>
      <DialogTrigger render={<Button size="sm" />}>New Round</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Auction Round</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Round name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Week 3 Loot" />
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Start time</Label>
              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End time</Label>
              <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" onClick={submit}>Create Round</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit round dialog ───────────────────────────────────────────────────────

function EditRoundDialog({
  round,
  open,
  onOpenChange,
  onUpdated,
}: {
  round: RoundRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}) {
  function toLocal(d: string) {
    const dt = new Date(d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  const [name, setName] = useState(round.name);
  const [endTime, setEndTime] = useState(toLocal(round.endTime));

  async function submit() {
    const res = await fetch(`/api/rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, endTime: new Date(endTime).toISOString() }),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Round updated — non-overridden items updated too");
    onOpenChange(false);
    onUpdated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-6 text-xs" />}>
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Round</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Round name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End time (cannot be earlier than now)</Label>
            <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Items with custom times will not be affected.
          </p>
          <Button className="w-full" onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add item dialog ─────────────────────────────────────────────────────────

function AddItemDialog({
  rounds,
  defaultRoundId,
  onAdded,
  standalone = false,
}: {
  rounds: RoundRow[];
  defaultRoundId?: string;
  onAdded: () => void;
  standalone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minBid, setMinBid] = useState("0");
  const [timerMode, setTimerMode] = useState<"hard" | "antisnipe">("hard");
  const [antiSnipeMinutes, setAntiSnipeMinutes] = useState("2");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function toLocal(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function prefillTimes() {
    if (standalone || !defaultRoundId) {
      const now = new Date();
      setStartTime(toLocal(now));
      setEndTime(toLocal(new Date(now.getTime() + 60 * 60 * 1000)));
    }
  }

  async function submit() {
    if (!name.trim()) return toast.error("Name required");

    const body: Record<string, unknown> = {
      name, description,
      minBid: parseInt(minBid) || 0,
      timerMode,
      antiSnipeMinutes: timerMode === "antisnipe" ? parseInt(antiSnipeMinutes) || 2 : null,
    };

    if (defaultRoundId) {
      body.roundId = defaultRoundId;
    } else {
      // Standalone — times required
      if (!startTime || !endTime) return toast.error("Set start and end time");
      body.startTime = new Date(startTime).toISOString();
      body.endTime = new Date(endTime).toISOString();
    }

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success("Item added");
    setName(""); setDescription(""); setMinBid("0"); setTimerMode("hard");
    setStartTime(""); setEndTime("");
    setOpen(false); onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) prefillTimes(); }}>
      <DialogTrigger render={<Button size="sm" className={defaultRoundId ? "h-6 text-xs" : undefined} />}>
        {defaultRoundId ? "Add Item" : "Add Item"}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {defaultRoundId
              ? `Add Item to Round`
              : "Add Standalone Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sword of Legends" />
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Minimum bid (0 = none)</Label>
            <Input type="number" min={0} value={minBid} onChange={(e) => setMinBid(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Timer mode</Label>
            <Select value={timerMode} onValueChange={(v) => v && setTimerMode(v as "hard" | "antisnipe")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hard">Hard cutoff</SelectItem>
                <SelectItem value="antisnipe">Anti-snipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {timerMode === "antisnipe" && (
            <div className="space-y-1">
              <Label>Extension window (minutes)</Label>
              <Input type="number" min={1} value={antiSnipeMinutes} onChange={(e) => setAntiSnipeMinutes(e.target.value)} />
            </div>
          )}

          {/* Times only shown for standalone items */}
          {(standalone || !defaultRoundId) && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Start time</Label>
                  <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>End time</Label>
                  <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {defaultRoundId && (
            <p className="text-xs text-muted-foreground">
              This item will inherit the round's start and end time.
            </p>
          )}

          <Button className="w-full" onClick={submit}>Add Item</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
