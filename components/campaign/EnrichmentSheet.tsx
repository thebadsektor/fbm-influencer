"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, Youtube, DollarSign, CheckCircle2, XCircle, BarChart3, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

interface WorkflowBreakdown {
  workflow: string;
  label: string;
  completed: number;
  running: number;
  pending: number;
  failed: number;
  empty: number;
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
  enrichmentProgress?: {
    eligible: number;
    attempted: number;
    remaining: number;
    emailsFound: number;
    attemptRate: number;
    emailHitRate: number;
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
  const [tabCache, setTabCache] = useState<Record<string, unknown>>({});
  const [tabLoading, setTabLoading] = useState(false);
  const [batchSize, setBatchSize] = useState("50");
  const [starting, setStarting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const perPage = 25;

  // Load status (polling target)
  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/status`);
    if (res.ok) setStatus(await res.json());
  }, [campaignId]);

  // Load tab data (cached per tab)
  const loadTab = useCallback(async (t: Tab) => {
    if (t === "overview") return;
    setTabLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/details?tab=${t}`);
    if (res.ok) {
      const data = await res.json();
      setTabCache((prev) => ({ ...prev, [t]: data }));
    }
    setTabLoading(false);
  }, [campaignId]);

  // Load status on open
  useEffect(() => {
    if (open) loadStatus();
  }, [open, loadStatus]);

  // Poll status continuously while the sheet is open. The previous
  // "only-when-active" logic froze the UI the moment the last run finished —
  // if a cron tick or callback then advanced things, the user had to close
  // and reopen to see it. 15 s is enough for a dashboard; 5 s was overkill.
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [open, loadStatus]);

  // Load tab data on tab switch (cached — only loads once per tab)
  useEffect(() => {
    if (!open || tab === "overview" || tabCache[tab]) return;
    loadTab(tab);
  }, [open, tab, tabCache, loadTab]);

  // Reset page on tab switch
  useEffect(() => { setPage(0); }, [tab]);

  const handleEnrich = async (workflowId: string) => {
    setStarting(workflowId);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/campaigns/${campaignId}/enrichment/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: workflowId, batchSize: Number(batchSize), confirm: true }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Failed"); }
    await loadStatus();
    setStarting(null);
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/enrichment/retry-failed`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Retry failed");
      } else {
        const sent = data.totalSent ?? 0;
        setInfo(sent > 0
          ? `Requeued ${sent} failed leads. They'll show up as "active" shortly.`
          : "No failed leads currently eligible for retry (batch threshold not met, or all in-flight).");
      }
      await loadStatus();
    } finally {
      setRetrying(false);
    }
  };

  const refreshTab = () => {
    setTabCache((prev) => { const n = { ...prev }; delete n[tab]; return n; });
    loadTab(tab);
  };

  const es = status?.emailStats;
  const ytStats = es?.byPlatform["YOUTUBE"];
  const tkStats = es?.byPlatform["TIKTOK"];
  const currentTabData = tabCache[tab] as Record<string, unknown> | undefined;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Mail className="h-3 w-3" /> },
    { key: "enriched", label: "Enriched", icon: <CheckCircle2 className="h-3 w-3" /> },
    { key: "attempted", label: "No Email", icon: <XCircle className="h-3 w-3" /> },
    { key: "insights", label: "Insights", icon: <BarChart3 className="h-3 w-3" /> },
  ];

  // Pagination helper
  const paginate = (items: unknown[]) => {
    const totalPages = Math.ceil(items.length / perPage);
    const pageItems = items.slice(page * perPage, (page + 1) * perPage);
    return { pageItems, totalPages, total: items.length };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Enrichment
            {status?.totalActive ? <Badge variant="secondary" className="animate-pulse text-xs">{status.totalActive} active</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!status ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {tab === "overview" && (
                <div className="max-w-2xl mx-auto space-y-6 py-6 px-6">
                  {/* Overall progress — honest metrics. Top row = attempt coverage,
                      bottom row = hit rate. Legacy "X% of all scraped" is gone because
                      it was capped by the qualified-rate and looked like a broken meter. */}
                  {status.enrichmentProgress ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-baseline justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Enrichment coverage</p>
                          <span className="text-sm text-muted-foreground">
                            {status.enrichmentProgress.attempted} / {status.enrichmentProgress.eligible} attempted
                            ({status.enrichmentProgress.attemptRate}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${status.enrichmentProgress.attemptRate}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div className="p-3 rounded-lg border bg-green-500/5">
                          <p className="text-xl font-bold text-green-500">{status.enrichmentProgress.emailsFound}</p>
                          <p className="text-[11px] text-muted-foreground">emails found</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{status.enrichmentProgress.emailHitRate}% hit rate</p>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xl font-bold text-muted-foreground">
                            {status.workflowBreakdown.reduce((s, w) => s + w.empty, 0)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">no public email</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">confirmed empty</p>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xl font-bold text-muted-foreground">{status.enrichmentProgress.remaining}</p>
                          <p className="text-[11px] text-muted-foreground">not yet attempted</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">use buttons below</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-3xl font-bold">{es!.withEmail} <span className="text-base font-normal text-muted-foreground">/ {es!.total} emails</span></p>
                        <span className="text-lg text-muted-foreground">{es!.percentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${es!.percentage}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Platform — full width cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {ytStats && (
                      <div className="p-4 bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-2"><Youtube className="h-4 w-4 text-red-500" /><span className="font-medium">YouTube</span></div>
                        <p className="text-2xl font-bold">{ytStats.withEmail} <span className="text-sm font-normal text-muted-foreground">/ {ytStats.total}</span></p>
                        <p className="text-xs text-muted-foreground">{ytStats.percentage}% with email</p>
                      </div>
                    )}
                    {tkStats && (
                      <div className="p-4 bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-2"><span>🎵</span><span className="font-medium">TikTok</span></div>
                        <p className="text-2xl font-bold">{tkStats.withEmail} <span className="text-sm font-normal text-muted-foreground">/ {tkStats.total}</span></p>
                        <p className="text-xs text-muted-foreground">{tkStats.percentage}% with email</p>
                      </div>
                    )}
                  </div>

                  {/* Workflows */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflows</p>
                    {status.workflowBreakdown.map((wf) => {
                      const empty = wf.empty ?? 0;
                      const totalRuns = wf.completed + wf.running + wf.pending + wf.failed + empty;
                      const isActive = wf.running > 0 || wf.pending > 0;
                      return (
                        <div key={wf.workflow} className="p-4 rounded-lg border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{wf.label}</span>
                            {isActive && <Badge variant="secondary" className="animate-pulse text-xs">{wf.running + wf.pending} active</Badge>}
                          </div>
                          {totalRuns > 0 ? (
                            <div className="grid grid-cols-5 gap-2 text-center">
                              <div className="p-2 rounded bg-muted/50"><p className="text-lg font-bold text-green-500">{wf.emailsFound}</p><p className="text-[11px] text-muted-foreground">emails</p></div>
                              <div className="p-2 rounded bg-muted/50"><p className="text-lg font-bold text-muted-foreground">{empty}</p><p className="text-[11px] text-muted-foreground">no email</p></div>
                              <div className="p-2 rounded bg-muted/50"><p className="text-lg font-bold text-blue-400">{wf.running + wf.pending}</p><p className="text-[11px] text-muted-foreground">active</p></div>
                              <div className="p-2 rounded bg-muted/50"><p className="text-lg font-bold text-red-400">{wf.failed}</p><p className="text-[11px] text-muted-foreground">failed</p></div>
                              <div className="p-2 rounded bg-muted/50"><p className="text-lg font-bold text-muted-foreground">{totalRuns}</p><p className="text-[11px] text-muted-foreground">total</p></div>
                            </div>
                          ) : <p className="text-sm text-muted-foreground">No runs yet</p>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual trigger */}
                  <div className="space-y-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual Enrichment</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Batch:</span>
                      <Select value={batchSize} onValueChange={setBatchSize}>
                        <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{["10", "25", "50", "100", "200"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" disabled={!!starting || retrying} onClick={() => handleEnrich("youtube-email-scraper")}>
                        {starting === "youtube-email-scraper" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Youtube className="h-4 w-4 mr-2" />} Enrich YouTube
                      </Button>
                      <Button variant="outline" className="flex-1" disabled={!!starting || retrying} onClick={() => handleEnrich("tiktok-linktree-scraper")}>
                        {starting === "tiktok-linktree-scraper" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <span className="mr-2">🎵</span>} Enrich TikTok
                      </Button>
                    </div>
                    {(() => {
                      const totalFailed = status.workflowBreakdown.reduce((s, w) => s + w.failed, 0);
                      if (totalFailed === 0) return null;
                      return (
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled={retrying || !!starting}
                          onClick={handleRetryFailed}
                        >
                          {retrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                          Retry {totalFailed} failed {totalFailed === 1 ? "lead" : "leads"}
                        </Button>
                      );
                    })()}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    {info && <p className="text-sm text-muted-foreground">{info}</p>}
                  </div>

                  {status.totalEnrichmentCost > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-2 border-t"><DollarSign className="h-3 w-3" />Total: ${status.totalEnrichmentCost.toFixed(2)}</p>
                  )}
                </div>
              )}

              {/* ENRICHED TAB */}
              {tab === "enriched" && (
                <div className="py-4">
                  {tabLoading && !currentTabData ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (() => {
                    const items = (currentTabData?.results as unknown[]) || [];
                    const { pageItems, totalPages, total } = paginate(items);
                    return (
                      <>
                        <div className="flex items-center justify-between px-6 mb-3">
                          <p className="text-sm text-muted-foreground">{total} contacts with email</p>
                          <Button variant="ghost" size="sm" onClick={refreshTab} className="text-xs">Refresh</Button>
                        </div>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left px-6 py-2 font-medium">Creator</th>
                            <th className="text-left px-3 py-2 font-medium">Email</th>
                            <th className="text-left px-3 py-2 font-medium">Source</th>
                            <th className="text-right px-3 py-2 font-medium">Fit</th>
                            <th className="text-right px-6 py-2 font-medium">Followers</th>
                          </tr></thead>
                          <tbody>
                            {pageItems.map((r) => {
                              const c = r as Record<string, unknown>;
                              const src = c.emailSource === "profile_bio" ? "Bio" : c.emailSource === "video_description" ? "Video" : c.emailSource === "apify-dataovercoffee" ? "YouTube API" : c.emailSource === "apify-linktree-scraper" ? "Linktree" : String(c.emailSource || "—");
                              return (
                                <tr key={c.id as string} className="border-b hover:bg-muted/30">
                                  <td className="px-6 py-2">
                                    <p className="font-medium truncate max-w-[200px]">{c.creatorName as string || "Unknown"}</p>
                                    <p className="text-xs text-muted-foreground">@{c.creatorHandle as string}</p>
                                  </td>
                                  <td className="px-3 py-2 text-green-500 truncate max-w-[200px]">{c.email as string}</td>
                                  <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{src}</Badge></td>
                                  <td className="px-3 py-2 text-right tabular-nums">{c.campaignFitScore != null ? c.campaignFitScore as number : "—"}</td>
                                  <td className="px-6 py-2 text-right tabular-nums text-muted-foreground">{c.followers as string || "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-6 pt-3">
                            <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ATTEMPTED TAB */}
              {tab === "attempted" && (
                <div className="py-4">
                  {tabLoading && !currentTabData ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (() => {
                    const items = (currentTabData?.results as unknown[]) || [];
                    const { pageItems, totalPages, total } = paginate(items);
                    return (
                      <>
                        <div className="flex items-center justify-between px-6 mb-3">
                          <p className="text-sm text-muted-foreground">{total} enriched but no email found</p>
                          <Button variant="ghost" size="sm" onClick={refreshTab} className="text-xs">Refresh</Button>
                        </div>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left px-6 py-2 font-medium">Creator</th>
                            <th className="text-left px-3 py-2 font-medium">Workflow Tried</th>
                            <th className="text-right px-3 py-2 font-medium">Fit</th>
                            <th className="text-right px-6 py-2 font-medium">Followers</th>
                          </tr></thead>
                          <tbody>
                            {pageItems.map((r) => {
                              const c = r as Record<string, unknown>;
                              const runs = (c.enrichmentRuns as { workflow: string }[]) || [];
                              const tried = runs.map((r) => r.workflow === "youtube-email-scraper" ? "YouTube" : r.workflow === "tiktok-linktree-scraper" ? "Linktree" : r.workflow).join(", ") || "—";
                              return (
                                <tr key={c.id as string} className="border-b hover:bg-muted/30">
                                  <td className="px-6 py-2">
                                    <p className="font-medium truncate max-w-[200px]">{c.creatorName as string || "Unknown"}</p>
                                    <p className="text-xs text-muted-foreground">@{c.creatorHandle as string}</p>
                                  </td>
                                  <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{tried}</Badge></td>
                                  <td className="px-3 py-2 text-right tabular-nums">{c.campaignFitScore != null ? c.campaignFitScore as number : "—"}</td>
                                  <td className="px-6 py-2 text-right tabular-nums text-muted-foreground">{c.followers as string || "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-6 pt-3">
                            <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* INSIGHTS TAB */}
              {tab === "insights" && (
                <div className="max-w-2xl mx-auto py-6 px-6">
                  {tabLoading && !currentTabData ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : currentTabData && (() => {
                    const summary = currentTabData.summary as { enrichmentSuccessRate?: number; bioParsingRate?: number; totalEnriched?: number; totalEmailsFromEnrichment?: number } | undefined;
                    const sourceBreakdown = currentTabData.sourceBreakdown as Record<string, number> | undefined;
                    const followerTierStats = currentTabData.followerTierStats as { tier: string; total: number; found: number; rate: number }[] | undefined;
                    return (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Performance Insights</p>
                          <Button variant="ghost" size="sm" onClick={refreshTab} className="text-xs">Refresh</Button>
                        </div>

                        {/* Summary cards */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-4 rounded-lg bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">{summary?.enrichmentSuccessRate || 0}%</p>
                            <p className="text-xs text-muted-foreground">API enrichment hit rate</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">{summary?.bioParsingRate || 0}%</p>
                            <p className="text-xs text-muted-foreground">Bio parsing rate</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 border text-center">
                            <p className="text-2xl font-bold">{summary?.totalEnriched || 0}</p>
                            <p className="text-xs text-muted-foreground">Channels processed</p>
                          </div>
                        </div>

                        {/* Email source breakdown */}
                        {sourceBreakdown && Object.keys(sourceBreakdown).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Email Sources</p>
                            <div className="space-y-2">
                              {Object.entries(sourceBreakdown).sort(([, a], [, b]) => b - a).map(([source, count]) => {
                                const total = Object.values(sourceBreakdown).reduce((s, c) => s + c, 0);
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                  <div key={source}>
                                    <div className="flex items-center justify-between text-sm mb-1">
                                      <span>{source}</span>
                                      <span className="font-medium">{count} <span className="text-muted-foreground">({pct}%)</span></span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5">
                                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Follower tier stats */}
                        {followerTierStats && followerTierStats.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">API Enrichment by Follower Tier</p>
                            <table className="w-full text-sm">
                              <thead><tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left py-2 font-medium">Tier</th>
                                <th className="text-right py-2 font-medium">Processed</th>
                                <th className="text-right py-2 font-medium">Emails Found</th>
                                <th className="text-right py-2 font-medium">Hit Rate</th>
                              </tr></thead>
                              <tbody>
                                {followerTierStats.map((t) => (
                                  <tr key={t.tier} className="border-b">
                                    <td className="py-2">{t.tier}</td>
                                    <td className="py-2 text-right tabular-nums">{t.total}</td>
                                    <td className="py-2 text-right tabular-nums text-green-500">{t.found}</td>
                                    <td className="py-2 text-right tabular-nums">{t.rate}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* What's working */}
                        <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                          <p className="font-medium text-sm">What&apos;s working</p>
                          <p className="text-sm text-muted-foreground">
                            Bio parsing ({summary?.bioParsingRate || 0}%) is the most effective email source — it&apos;s free and captures emails directly from creator profiles. API enrichment has a {summary?.enrichmentSuccessRate || 0}% hit rate across {summary?.totalEnriched || 0} channels processed.
                          </p>
                          {(summary?.enrichmentSuccessRate || 0) < 5 && (summary?.totalEnriched || 0) > 50 && (
                            <p className="text-sm text-muted-foreground">
                              The low API hit rate suggests most creators don&apos;t have public business emails on YouTube. Focus enrichment budget on creators with higher follower counts or existing link-in-bio URLs.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
