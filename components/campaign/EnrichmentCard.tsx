"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, DollarSign, Youtube } from "lucide-react";

const COST_PER_CHANNEL = 0.005;

interface EmailStats {
  total: number;
  withEmail: number;
  percentage: number;
  byPlatform: Record<string, { total: number; withEmail: number; percentage: number }>;
}

interface EnrichmentStatus {
  emailStats: EmailStats;
  activeRuns: { workflow: string; total: number; running: number; pending: number }[];
  recentRuns: { count: number; emailsFound: number; totalCost: number };
  totalEnrichmentCost: number;
}

export function EnrichmentCard({ campaignId }: { campaignId: string }) {
  const [status, setStatus] = useState<EnrichmentStatus | null>(null);
  const [batchSize, setBatchSize] = useState("50");
  const [starting, setStarting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/status`);
    if (res.ok) setStatus(await res.json());
  }, [campaignId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (!status?.activeRuns.length) return;
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [status?.activeRuns.length, loadStatus]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: "youtube-email-scraper", batchSize: Number(batchSize), confirm: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowConfirm(false);
      await loadStatus();
    } else {
      setError(data.error || "Failed to start");
    }
    setStarting(false);
  };

  if (!status) return null;

  const { emailStats, activeRuns, recentRuns, totalEnrichmentCost } = status;
  const ytStats = emailStats.byPlatform["YOUTUBE"];
  const tkStats = emailStats.byPlatform["TIKTOK"];
  const isRunning = activeRuns.length > 0;
  const ytNeedEnrichment = ytStats ? ytStats.total - ytStats.withEmail : 0;
  const batch = Math.min(Number(batchSize), ytNeedEnrichment);
  const estimatedCost = (batch * COST_PER_CHANNEL).toFixed(2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5" />
          Email Enrichment
          {isRunning && <Badge variant="secondary" className="animate-pulse text-xs">Running</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {ytStats && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-1">
                <Youtube className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">YouTube</span>
              </div>
              <p className="text-xl font-bold">{ytStats.withEmail} <span className="text-sm font-normal text-muted-foreground">/ {ytStats.total}</span></p>
              <p className="text-xs text-muted-foreground">{ytStats.percentage}% with email</p>
            </div>
          )}
          {tkStats && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🎵</span>
                <span className="text-sm font-medium">TikTok</span>
              </div>
              <p className="text-xl font-bold">{tkStats.withEmail} <span className="text-sm font-normal text-muted-foreground">/ {tkStats.total}</span></p>
              <p className="text-xs text-muted-foreground">{tkStats.percentage}% with email</p>
            </div>
          )}
        </div>

        {totalEnrichmentCost > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Total enrichment cost: ${totalEnrichmentCost.toFixed(2)}
            {recentRuns.count > 0 && ` • ${recentRuns.emailsFound} emails from ${recentRuns.count} runs`}
          </p>
        )}

        {/* Active run */}
        {isRunning && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="text-sm">Processing channels...</span>
          </div>
        )}

        {/* Enrichment action */}
        {!isRunning && ytNeedEnrichment > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Batch:</span>
              <Select value={batchSize} onValueChange={(v) => { setBatchSize(v); setShowConfirm(false); }}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "25", "50", "100", "200"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground flex-1">{ytNeedEnrichment} channels need enrichment</span>
            </div>

            {!showConfirm ? (
              <Button variant="outline" onClick={() => setShowConfirm(true)} className="w-full">
                <Youtube className="h-4 w-4 mr-2" />
                Enrich YouTube Emails (~${estimatedCost})
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm flex-1">
                  Enrich <strong>{batch}</strong> channels for ~<strong>${estimatedCost}</strong>?
                </p>
                <Button size="sm" onClick={handleStart} disabled={starting}>
                  {starting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                  Run
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>Cancel</Button>
              </div>
            )}
          </div>
        )}

        {ytNeedEnrichment === 0 && ytStats && (
          <p className="text-sm text-muted-foreground text-center py-2">All YouTube channels enriched ✓</p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
