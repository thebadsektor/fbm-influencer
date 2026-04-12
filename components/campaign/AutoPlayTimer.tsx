"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface AutoPlayTimerProps {
  campaignId: string;
  seconds?: number;
  onStarted?: () => void;
}

export function AutoPlayTimer({ campaignId, seconds = 30, onStarted }: AutoPlayTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [starting, setStarting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const triggerContinue = async () => {
    setStarting(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/continue`, { method: "POST" });
      onStarted?.();
    } catch {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (starting || remaining <= 0) return;

    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          triggerContinue();
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starting]);

  if (starting) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Starting next round...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
      {/* Countdown circle */}
      <div className="relative h-10 w-10 flex-shrink-0">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3" />
          <circle
            cx="24" cy="24" r="20" fill="none" stroke="currentColor"
            className="text-primary transition-all duration-1000"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - remaining / seconds)}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {remaining}s
        </span>
      </div>

      <p className="text-sm text-muted-foreground flex-1">
        Starting next discovery round in {remaining}s...
      </p>
    </div>
  );
}
