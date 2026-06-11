"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Player {
  id: string;
  username: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then(setPlayers)
      .catch(() => {});
  }, []);

  const isAdmin = selected === "__admin__";

  async function handleLogin() {
    if (!selected) return toast.error("Please select a user");
    if (isAdmin && !password) return toast.error("Password required");

    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isAdmin
          ? { role: "admin", password }
          : { role: "player", username: selected }
      ),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) return toast.error(data.error ?? "Login failed");

    toast.success(`Logged in as ${isAdmin ? "Admin" : selected}`);
    router.push(isAdmin ? "/admin" : "/play");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Guild Bid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Who are you?</Label>
            <Select onValueChange={(v) => setSelected(v ?? "")} value={selected}>
              <SelectTrigger>
                <SelectValue placeholder="Select your name…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__admin__">Admin</SelectItem>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.username}>
                    {p.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <Label>Admin password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Password"
              />
            </div>
          )}

          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            <a href="/dashboard" className="underline underline-offset-2">
              View public dashboard
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
