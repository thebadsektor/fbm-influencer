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
import { Mail, Loader2, Youtube, DollarSign, ExternalLink, CheckCircle2, XCircle, BarChart3 } from "lucide-react";

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
}

type Tab = "overview" | "enriched" | "attempted" | "insights";

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
  const [tab, setTab] = useState<Tab>("overview");
  const [tabData, setTabData] = useState<Record<string, unknown> | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [batchSize, setBatchSize] = useState("50");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!open) return;
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/status`);
    if (res.ok) setStatus(await res.json());
  }, [campaignId, open]);

  const loadTab = useCallback(async (t: Tab) => {
    if (t === "overview") { setTabData(null); return; }
    setTabLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/details?tab=${t}`);
    if (res.ok) setTabData(await res.json());
    setTabLoading(false);
  }, [campaignId]);

  useEffect(() => { if (open) { loadStatus(); loadTab(tab); } }, [open, loadStatus, loadTab, tab]);

  useEffect(() => {
    if (!open || !status?.totalActive) return;
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [open, status?.totalActive, loadStatus]);

  const handleEnrich = async (workflowId: string) => {
    setStarting(workflowId);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: workflowId, batchSize: Number(batchSize), confirm: true }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Failed"); }
    await loadStatus();
    setStarting(null);
  };

  const es = status?.emailStats;
  const ytStats = es?.byPlatform["YOUTUBE"];
  const tkStats = es?.byPlatform["TIKTOK"];

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Mail className="h-3 w-3" /> },
    { key: "enriched", label: "Enriched", icon: <CheckCircle2 className="h-3 w-3" /> },
    { key: "attempted", label: "No Email", icon: <XCircle className="h-3 w-3" /> },
    { key: "insights", label: "Insights", icon: <BarChart3 className="h-3 w-3" /> },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:w-[500px] overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Enrichment
            {status?.totalActive ? <Badge variant="secondary" className="animate-pulse text-xs">{status.totalActive} active</Badge> : null}
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {!status ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="pb-6">
            {/* OVERVIEW TAB */}
            {tab === "overview" && (
              <div className="space-y-5 pt-4">
                <div className="px-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-2xl font-bold">{es!.withEmail} <span className="text-sm font-normal text-muted-foreground">/ {es!.total} emails</span></p>
                    <span className="text-sm text-muted-foreground">{es!.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${es!.percentage}%` }} />
                  </div>
                </div>

                {/* Platform — full width */}
                <div className="-mx-0">
                  {ytStats && (
                    <div className="flex items-center justify-between px-6 py-2.5 bg-muted/50 border-y border-border/50">
                      <div className="flex items-center gap-2"><Youtube className="h-4 w-4 text-red-500" /><span className="text-sm font-medium">YouTube</span></div>
                      <span className="text-sm tabular-nums">{ytStats.withEmail} / {ytStats.total} <span className="text-muted-foreground">({ytStats.percentage}%)</span></span>
                    </div>
                  )}
                  {tkStats && (
                    <div className="flex items-center justify-between px-6 py-2.5 bg-muted/50 border-b border-border/50">
                      <div className="flex items-center gap-2"><span>🎵</span><span className="text-sm font-medium">TikTok</span></div>
                      <span className="text-sm tabular-nums">{tkStats.withEmail} / {tkStats.total} <span className="text-muted-foreground">({tkStats.percentage}%)</span></span>
                    </div>
                  )}
                </div>

                {/* Workflows */}
                <div className="space-y-2 px-6">
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
                            <div><p className="font-bold text-green-500">{wf.completed}</p><p className="text-muted-foreground">done</p></div>
                            <div><p className="font-bold text-blue-400">{wf.running + wf.pending}</p><p className="text-muted-foreground">active</p></div>
                            <div><p className="font-bold text-red-400">{wf.failed}</p><p className="text-muted-foreground">failed</p></div>
                            <div><p className="font-bold text-green-400">{wf.emailsFound}</p><p className="text-muted-foreground">emails</p></div>
                          </div>
                        )}
                        {totalRuns === 0 && <p className="text-xs text-muted-foreground">No runs yet</p>}
                      </div>
                    );
                  })}
                </div>

                {/* Manual trigger */}
                <div className="space-y-3 pt-2 border-t px-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual Enrichment</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Batch:</span>
                    <Select value={batchSize} onValueChange={setBatchSize}>
                      <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{["10", "25", "50", "100", "200"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" disabled={!!starting} onClick={() => handleEnrich("youtube-email-scraper")}>
                      {starting === "youtube-email-scraper" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Youtube className="h-3 w-3 mr-1" />} Enrich YouTube
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" disabled={!!starting} onClick={() => handleEnrich("tiktok-linktree-scraper")}>
                      {starting === "tiktok-linktree-scraper" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <span className="mr-1">🎵</span>} Enrich TikTok
                    </Button>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                {status.totalEnrichmentCost > 0 && (
                  <div className="pt-2 border-t px-6">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total: ${status.totalEnrichmentCost.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}

            {/* ENRICHED TAB */}
            {tab === "enriched" && (
              <div className="pt-4">
                {tabLoading ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
                  <div>
                    <p className="text-xs text-muted-foreground px-6 mb-3">{(tabData as { total?: number })?.total || 0} contacts with email</p>
                    <div className="divide-y">
                      {((tabData as { results?: unknown[] })?.results || []).map((r: unknown) => {
                        const c = r as Record<string, unknown>;
                        return (
                          <div key={c.id as string} className="px-6 py-2.5 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.creatorName as string || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground truncate">@{c.creatorHandle as string}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-green-500 truncate max-w-[160px]">{c.email as string}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.emailSource === "profile_bio" ? "Bio" :
                                 c.emailSource === "video_description" ? "Video" :
                                 c.emailSource === "apify-dataovercoffee" ? "YouTube Enrichment" :
                                 c.emailSource === "apify-linktree-scraper" ? "Linktree" :
                                 c.emailSource as string || "Unknown"}
                                {c.campaignFitScore ? ` • Fit: ${c.campaignFitScore}` : ""}
                              </p>
                            </div>
                            {(c.profileUrl as string) ? (
                              <a href={c.profileUrl as string} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATTEMPTED (NO EMAIL) TAB */}
            {tab === "attempted" && (
              <div className="pt-4">
                {tabLoading ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
                  <div>
                    <p className="text-xs text-muted-foreground px-6 mb-3">{(tabData as { total?: number })?.total || 0} contacts enriched but no email found</p>
                    <div className="divide-y">
                      {((tabData as { results?: unknown[] })?.results || []).map((r: unknown) => {
                        const c = r as Record<string, unknown>;
                        const runs = (c.enrichmentRuns as { workflow: string }[]) || [];
                        return (
                          <div key={c.id as string} className="px-6 py-2.5 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.creatorName as string || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground truncate">@{c.creatorHandle as string}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {runs.length > 0 ? runs.map((r) => r.workflow === "youtube-email-scraper" ? "YouTube" : "Linktree").join(", ") : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {c.followers ? `${parseInt(c.followers as string) >= 1000 ? `${Math.round(parseInt(c.followers as string) / 1000)}K` : c.followers} followers` : ""}
                                {c.campaignFitScore ? ` • Fit: ${c.campaignFitScore}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INSIGHTS TAB */}
            {tab === "insights" && (
              <div className="pt-4 space-y-5 px-6">
                {tabLoading ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : tabData && (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xl font-bold">{(tabData as { summary?: { enrichmentSuccessRate?: number } }).summary?.enrichmentSuccessRate || 0}%</p>
                        <p className="text-xs text-muted-foreground">Enrichment hit rate</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xl font-bold">{(tabData as { summary?: { bioParsingRate?: number } }).summary?.bioParsingRate || 0}%</p>
                        <p className="text-xs text-muted-foreground">Bio parsing rate</p>
                      </div>
                    </div>

                    {/* Email source breakdown */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Email Sources</p>
                      <div className="space-y-1.5">
                        {Object.entries((tabData as { sourceBreakdown?: Record<string, number> }).sourceBreakdown || {})
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([source, count]) => (
                          <div key={source} className="flex items-center justify-between">
                            <span className="text-sm">{source}</span>
                            <span className="text-sm font-medium">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Success rate by follower tier */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Enrichment by Follower Tier</p>
                      <div className="space-y-1.5">
                        {((tabData as { followerTierStats?: { tier: string; total: number; found: number; rate: number }[] }).followerTierStats || []).map((t) => (
                          <div key={t.tier} className="flex items-center justify-between text-sm">
                            <span>{t.tier}</span>
                            <span className="tabular-nums">
                              <span className="text-green-500">{t.found}</span>
                              <span className="text-muted-foreground"> / {t.total}</span>
                              <span className="text-muted-foreground ml-1">({t.rate}%)</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium mb-1">What&apos;s working</p>
                      <p className="text-xs text-muted-foreground">
                        Bio parsing ({(tabData as { summary?: { bioParsingRate?: number } }).summary?.bioParsingRate || 0}%) yields more emails than enrichment ({(tabData as { summary?: { enrichmentSuccessRate?: number } }).summary?.enrichmentSuccessRate || 0}%). Creators who include email in their bio or video descriptions are the most cost-effective source — no external API cost.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
