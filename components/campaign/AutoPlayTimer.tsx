"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2 } from "lucide-react";

interface AutoPlayTimerProps {
  campaignId: string;
  seconds?: number;
  onStarted?: () => void;
}

export function AutoPlayTimer({ campaignId, seconds = 30, onStarted }: AutoPlayTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);
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
    if (paused || starting || remaining <= 0) return;

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
  }, [paused, starting]);

  if (starting) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Starting next round...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
      {/* Countdown circle */}
      <div className="relative h-12 w-12 flex-shrink-0">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
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

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {paused ? "Auto-start paused" : `Auto-starting next round in ${remaining}s...`}
        </p>
        <p className="text-xs text-muted-foreground">
          {paused ? "Click resume or start now to continue" : "Pause to review the plan before continuing"}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          size="sm"
          onClick={triggerContinue}
          disabled={starting}
        >
          Start Now
        </Button>
      </div>
    </div>
  );
}
