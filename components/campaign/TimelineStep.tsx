"use client";

import { useState, useEffect } from "react";
import { ChevronDown, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "completed" | "failed";

interface TimelineStepProps {
  title: string;
  status: StepStatus;
  summary?: string;
  icon?: React.ReactNode;
  duration?: string;
  cost?: string;
  defaultExpanded?: boolean;
  onRetry?: () => Promise<void>;
  retryLabel?: string;
  isLast?: boolean;
  children?: React.ReactNode;
}

export function TimelineStep({
  title,
  status,
  summary,
  icon,
  duration,
  cost,
  defaultExpanded,
  onRetry,
  retryLabel = "Retry",
  isLast = false,
  children,
}: TimelineStepProps) {
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? (status === "active" || status === "failed")
  );
  const [retrying, setRetrying] = useState(false);

  // Auto-expand when step becomes active
  useEffect(() => {
    if (status === "active") setExpanded(true);
  }, [status]);

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try { await onRetry(); } finally { setRetrying(false); }
  };

  const dotColor = {
    pending: "border-muted-foreground/30 bg-background",
    active: "border-blue-500 bg-blue-500/20 animate-pulse",
    completed: "border-green-500 bg-green-500",
    failed: "border-red-500 bg-red-500",
  }[status];

  const hasContent = status !== "pending" && children;

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-border" />
      )}

      {/* Step dot */}
      <div className={cn("absolute left-1 top-1.5 w-[14px] h-[14px] rounded-full border-2", dotColor)} />

      {/* Step content */}
      <div className={cn("pb-6", isLast && "pb-2")}>
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 cursor-pointer select-none",
            status === "pending" && "opacity-40"
          )}
          onClick={() => hasContent && setExpanded(!expanded)}
        >
          {icon}
          <span className={cn("font-medium text-sm", status === "active" && "text-blue-400")}>
            {title}
          </span>
          {status === "completed" && <span className="text-green-500 text-xs font-medium">✓</span>}
          {status === "active" && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
          {status === "failed" && <span className="text-red-500 text-xs font-medium">✗</span>}
          {duration && <span className="text-xs text-muted-foreground">({duration})</span>}
          {cost && <span className="text-xs text-muted-foreground">${cost}</span>}

          {hasContent && (
            <ChevronDown className={cn("h-3 w-3 text-muted-foreground ml-auto transition-transform", !expanded && "-rotate-90")} />
          )}
        </div>

        {/* Summary line (when collapsed) */}
        {summary && !expanded && status !== "pending" && (
          <p className="text-xs text-muted-foreground mt-1">{summary}</p>
        )}

        {/* Expanded content */}
        {expanded && hasContent && (
          <div className="mt-3 space-y-3">
            {children}
          </div>
        )}

        {/* Retry button */}
        {status === "failed" && onRetry && (
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying} className="mt-2">
            {retrying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
