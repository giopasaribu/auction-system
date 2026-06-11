"use client";

import { useEffect, useState } from "react";

function formatDuration(ms: number) {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function Countdown({ endTime, className }: { endTime: string | Date; className?: string }) {
  const [remaining, setRemaining] = useState(() => new Date(endTime).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(endTime).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const urgent = remaining > 0 && remaining < 60_000;

  return (
    <span className={`tabular-nums ${urgent ? "text-red-500 font-semibold" : ""} ${className ?? ""}`}>
      {formatDuration(remaining)}
    </span>
  );
}
