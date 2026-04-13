"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, Youtube, DollarSign, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface WorkflowBreakdown {
  workflow: string;
  label: string;
  completed: number;
  running: number;
  pending: number;
  failed: number;
  emailsFound: number;
  cost: number;
}

interface EnrichmentStatus {
  emailStats: {
    total: number;
    withEmail: number;
    percentage: number;
    byPlatform: Record<string, { total: number; withEmail: number; percentage: number }>;
  };
  workflowBreakdown: WorkflowBreakdown[];
  totalActive: number;
  totalEnrichmentCost: number;
  enrichmentBudget: number | null;
}

export function EnrichmentSheet({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<EnrichmentStatus | null>(null);
  const [batchSize, setBatchSize] = useState("50");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/status`);
    if (res.ok) setStatus(await res.json());
  }, [campaignId, open]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Poll when active runs exist
  useEffect(() => {
    if (!open || !status?.totalActive) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [open, status?.totalActive, load]);

  const handleEnrich = async (workflowId: string) => {
    setStarting(workflowId);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: workflowId, batchSize: Number(batchSize), confirm: true }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Failed to start");
    await load();
    setStarting(null);
  };

  const es = status?.emailStats;
  const ytStats = es?.byPlatform["YOUTUBE"];
  const tkStats = es?.byPlatform["TIKTOK"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Enrichment
            {status?.totalActive ? (
              <Badge variant="secondary" className="animate-pulse text-xs">{status.totalActive} active</Badge>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {!status ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Overall progress */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-2xl font-bold">{es!.withEmail} <span className="text-sm font-normal text-muted-foreground">/ {es!.total} emails</span></p>
                <span className="text-sm text-muted-foreground">{es!.percentage}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${es!.percentage}%` }} />
              </div>
            </div>

            {/* Platform breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Platform</p>
              {ytStats && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">YouTube</span>
                  </div>
                  <span className="text-sm tabular-nums">{ytStats.withEmail} / {ytStats.total} <span className="text-muted-foreground">({ytStats.percentage}%)</span></span>
                </div>
              )}
              {tkStats && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span>🎵</span>
                    <span className="text-sm font-medium">TikTok</span>
                  </div>
                  <span className="text-sm tabular-nums">{tkStats.withEmail} / {tkStats.total} <span className="text-muted-foreground">({tkStats.percentage}%)</span></span>
                </div>
              )}
            </div>

            {/* Workflow breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflows</p>
              {status.workflowBreakdown.map((wf) => {
                const totalRuns = wf.completed + wf.running + wf.pending + wf.failed;
                const isActive = wf.running > 0 || wf.pending > 0;
                return (
                  <div key={wf.workflow} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{wf.label}</span>
                      {isActive && <Badge variant="secondary" className="animate-pulse text-xs">{wf.running + wf.pending} active</Badge>}
                    </div>
                    {totalRuns > 0 && (
                      <div className="grid grid-cols-4 gap-1 text-center text-xs">
                        <div>
                          <p className="font-bold text-green-500">{wf.completed}</p>
                          <p className="text-muted-foreground">done</p>
                        </div>
                        <div>
                          <p className="font-bold text-blue-400">{wf.running + wf.pending}</p>
                          <p className="text-muted-foreground">active</p>
                        </div>
                        <div>
                          <p className="font-bold text-red-400">{wf.failed}</p>
                          <p className="text-muted-foreground">failed</p>
                        </div>
                        <div>
                          <p className="font-bold text-green-400">{wf.emailsFound}</p>
                          <p className="text-muted-foreground">emails</p>
                        </div>
                      </div>
                    )}
                    {wf.cost > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />{wf.cost.toFixed(2)}
                      </p>
                    )}
                    {totalRuns === 0 && (
                      <p className="text-xs text-muted-foreground">No runs yet</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Manual trigger */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual Enrichment</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Batch:</span>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["10", "25", "50", "100", "200"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!!starting}
                  onClick={() => handleEnrich("youtube-email-scraper")}
                >
                  {starting === "youtube-email-scraper" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Youtube className="h-3 w-3 mr-1" />}
                  Enrich YouTube
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!!starting}
                  onClick={() => handleEnrich("tiktok-linktree-scraper")}
                >
                  {starting === "tiktok-linktree-scraper" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <span className="mr-1">🎵</span>}
                  Enrich TikTok
                </Button>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            {/* Cost summary */}
            {status.totalEnrichmentCost > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Total enrichment cost: ${status.totalEnrichmentCost.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
