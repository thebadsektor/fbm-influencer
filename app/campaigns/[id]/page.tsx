"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimelineStep, type StepStatus } from "@/components/campaign/TimelineStep";
import { AutoPlayTimer } from "@/components/campaign/AutoPlayTimer";
// EnrichmentCard removed — enrichment is now a timeline step
import type { LLMProvider } from "@/lib/llm";
import { PROVIDER_LABELS } from "@/lib/llm";
import { IDLE_MESSAGES } from "@/lib/idle-messages";
import {
  ArrowLeft,
  Upload,
  FileText,
  FileCode,
  File,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Users,
  Target,
  StopCircle,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  Search,
  Brain,
  Lightbulb,
  Mail,
  Maximize2,
  ExternalLink,
  DollarSign,
  Clock,
  RotateCcw,
  Pencil,
} from "lucide-react";

// ── Types ──

interface AffinityProfile {
  campaignFitScore: number;
  campaignFitReason: string;
  collaboratability?: { score: number; reason: string; flags: string[] };
  content_themes?: string[];
  summary?: string;
}

interface Result {
  id: string;
  platform: string;
  creatorName: string | null;
  creatorHandle: string | null;
  profileUrl: string | null;
  email: string | null;
  followers: string | null;
  engagementRate: string | null;
  bio: string | null;
  avatar: string | null;
  campaignFitScore: number | null;
  affinityProfile: AffinityProfile | null;
}

interface IterationData {
  khSetId: string | null;
  profiledCount: number;
  skippedCount: number;
  avgFitScore: number | null;
  profilingCost: number | null;
  profilingDuration: number | null;
  discoveryDuration: number | null;
  analysisNarrative: string | null;
  strategyForNext: string | null;
  learnings: string[];
  topPerformingKeywords: string[];
  lowPerformingKeywords: string[];
  enrichmentResults: Record<string, { workflowId: string; sent: number; deferred: boolean; reason?: string }> | null;
}

interface KHSetData {
  id: string;
  status: string;
  keywords: string[];
  hashtags: string[];
  iterationNumber: number;
  totalScraped: number;
  createdAt: string;
  platform: string | null;
  _count?: { results: number };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  marketingGoal: string;
  brandNiche: string;
  targetLeads: number;
  targetKeywords: number;
  targetHashtags: number;
  autoRun: boolean;
  documents: { id: string; filename: string; createdAt: string }[];
  khSets: KHSetData[];
  iterations: IterationData[];
}

interface LogEntry {
  stage: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "gemini"];

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (filename.endsWith(".md")) return <FileCode className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFollowers(f: string | null) {
  if (!f) return "-";
  const n = parseInt(f);
  if (isNaN(n)) return f;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// ── Live Log (inline, not a separate component) ──

function useLiveLog(khSetId: string | null, isActive: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const lastRealRef = useRef(Date.now());
  const idleRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!khSetId || !isActive) return;

    const parts = window.location.pathname.split("/");
    const campaignId = parts[2];
    const url = `/api/campaigns/${campaignId}/kh-sets/${khSetId}/stream`;

    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (idleRef.current) { clearInterval(idleRef.current); idleRef.current = null; }

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        if (entry.stage === "connected") {
          setLogs((p) => p.some((l) => l.stage === "connected") ? p : [...p, entry]);
          return;
        }
        lastRealRef.current = Date.now();
        setLogs((p) => [...p, entry]);
      } catch { /* heartbeat */ }
    };

    idleRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - lastRealRef.current) / 1000);
      if (elapsed >= 30) {
        const msg = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)];
        const fmt = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
        setLogs((p) => [...p, { stage: "idle", message: `${msg} (${fmt} since last update)`, timestamp: new Date().toISOString() }]);
      }
    }, 30000);

    return () => {
      if (idleRef.current) clearInterval(idleRef.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  }, [khSetId, isActive]);

  return logs;
}

// ── Results Modal ──

function ResultsModal({ results, open, onClose, title }: {
  results: Result[];
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  const [page, setPage] = useState(0);
  const perPage = 25;
  const totalPages = Math.ceil(results.length / perPage);
  const pageResults = results.slice(page * perPage, (page + 1) * perPage);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {title} <Badge variant="secondary">{results.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Creator</TableHead><TableHead>Platform</TableHead><TableHead>Email</TableHead>
              <TableHead>Followers</TableHead><TableHead>Fit Score</TableHead><TableHead>Bio</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pageResults.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.avatar && <img src={r.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />}
                      <div><p className="text-sm font-medium truncate">{r.creatorName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">@{r.creatorHandle}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.platform === "TIKTOK" ? "TikTok" : "YouTube"}</Badge></TableCell>
                  <TableCell>{r.email ? <span className="flex items-center gap-1 text-green-500 text-sm"><Mail className="h-3 w-3" />{r.email}</span> : <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className="tabular-nums text-sm">{formatFollowers(r.followers)}</TableCell>
                  <TableCell>
                    {r.campaignFitScore != null ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="cursor-pointer">
                            <Badge variant={r.campaignFitScore >= 60 ? "default" : "secondary"} className="hover:ring-2 hover:ring-primary/50 transition-all">
                              {r.campaignFitScore}
                            </Badge>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-sm space-y-2" side="left">
                          <p className="font-medium">Fit Score: {r.campaignFitScore}/100</p>
                          {(r.affinityProfile as AffinityProfile | null)?.campaignFitReason && (
                            <p className="text-muted-foreground">{(r.affinityProfile as AffinityProfile).campaignFitReason}</p>
                          )}
                          {(r.affinityProfile as AffinityProfile | null)?.collaboratability && (
                            <div className="pt-1 border-t">
                              <p className="text-xs font-medium">Collaboratability: {(r.affinityProfile as AffinityProfile).collaboratability?.score}/100</p>
                              <p className="text-xs text-muted-foreground">{(r.affinityProfile as AffinityProfile).collaboratability?.reason}</p>
                              {(r.affinityProfile as AffinityProfile).collaboratability?.flags?.length ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(r.affinityProfile as AffinityProfile).collaboratability!.flags.map((f) => (
                                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}
                          {(r.affinityProfile as AffinityProfile | null)?.content_themes && (
                            <div className="pt-1 border-t">
                              <p className="text-xs font-medium mb-1">Themes</p>
                              <div className="flex flex-wrap gap-1">
                                {(r.affinityProfile as AffinityProfile).content_themes!.slice(0, 6).map((t) => (
                                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {(r.affinityProfile as AffinityProfile | null)?.summary && (
                            <p className="text-xs text-muted-foreground italic pt-1 border-t">{(r.affinityProfile as AffinityProfile).summary}</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.bio?.slice(0, 80) || "-"}</TableCell>
                  <TableCell>{r.profileUrl && <a href={r.profileUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm" className="h-7 px-2"><ExternalLink className="h-3 w-3" /></Button></a>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Timeline Round ──

function TimelineRound({
  khSet,
  iteration,
  campaignId,
  campaignStatus,
  isLatest,
  results,
  onRefresh,
  autoRun,
}: {
  khSet: KHSetData;
  iteration: IterationData | null;
  campaignId: string;
  campaignStatus: string;
  isLatest: boolean;
  results: Result[];
  onRefresh: () => void;
  autoRun: boolean;
}) {
  const [showAllCreators, setShowAllCreators] = useState(false);
  const [showQualified, setShowQualified] = useState(false);
  const [showUnqualified, setShowUnqualified] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const resultCount = khSet.totalScraped || khSet._count?.results || 0;
  const isActive = khSet.status === "processing" || (isLatest && ["profiling", "analyzing", "enriching", "awaiting_approval", "iterating"].includes(campaignStatus));

  // Determine step statuses
  const getDiscoveryStatus = (): StepStatus => {
    if (khSet.status === "processing") return "active";
    if (khSet.status === "failed") return "failed";
    if (khSet.status === "completed") return "completed";
    return "pending";
  };

  const getCreatorsStatus = (): StepStatus => {
    if (khSet.status === "completed" && resultCount > 0) return "completed";
    if (khSet.status === "processing" && resultCount > 0) return "active";
    return "pending";
  };

  const getProfilingStatus = (): StepStatus => {
    if (getDiscoveryStatus() !== "completed") return "pending";
    if (iteration && iteration.profiledCount > 0) return "completed";
    if (isLatest && campaignStatus === "profiling") return "active";
    if (isLatest && ["analyzing", "enriching", "awaiting_approval", "iterating"].includes(campaignStatus)) return "completed";
    // Campaign ended but profiling never ran for this round — needs action
    if (isLatest && khSet.status === "completed" && !iteration && ["completed", "failed"].includes(campaignStatus)) return "failed";
    return "pending";
  };

  const getEnrichmentStatus = (): StepStatus => {
    if (getProfilingStatus() !== "completed") return "pending";
    const er = iteration?.enrichmentResults;
    if (er && Object.keys(er).length > 0) return "completed";
    // Past rounds: if iteration exists and has analysis, enrichment step passed (even if no enrichmentResults field)
    if (!isLatest && iteration?.analysisNarrative) return "completed";
    if (isLatest && campaignStatus === "enriching") return "active";
    if (isLatest && ["awaiting_approval", "iterating"].includes(campaignStatus)) return "completed";
    return "pending";
  };

  const getOptimizationStatus = (): StepStatus => {
    const enrichStatus = getEnrichmentStatus();
    if (enrichStatus === "pending" || enrichStatus === "active") return "pending";
    // Past rounds: if iteration has analysis, it's completed
    if (!isLatest && iteration?.analysisNarrative) return "completed";
    if (isLatest && campaignStatus === "awaiting_approval") return "active";
    if (isLatest && campaignStatus === "analyzing") return "pending";
    if (iteration?.analysisNarrative) return "completed";
    return "pending";
  };

  const logs = useLiveLog(isActive ? khSet.id : null, isActive);

  // Parse profiling progress from live log events
  const profilingProgressEvent = logs.filter((l) => l.stage === "profiling_progress").slice(-1)[0];
  const profilingProgressData = profilingProgressEvent?.data as { current?: number; total?: number } | undefined;
  const profilingSummaryEvent = logs.filter((l) => l.stage === "profiling_summary").slice(-1)[0];

  const handleRetryDiscovery = async () => {
    // Reset to draft then re-submit
    await fetch(`/api/campaigns/${campaignId}/kh-sets/${khSet.id}/reset`, { method: "POST" });
    await fetch(`/api/campaigns/${campaignId}/kh-sets/${khSet.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: khSet.platform || "both" }),
    });
    onRefresh();
  };

  const handleDeleteRound = async () => {
    if (!window.confirm(`Delete Round ${khSet.iterationNumber}? This will remove all its results.`)) return;
    await fetch(`/api/campaigns/${campaignId}/kh-sets/${khSet.id}`, { method: "DELETE" });
    onRefresh();
  };

  const handleRetryProfiling = async () => {
    setRetrying(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/kh-sets/${khSet.id}/reanalyze`, { method: "POST" });
      onRefresh();
    } finally { setRetrying(false); }
  };

  const qualifiedResults = results.filter((r) => (r.campaignFitScore ?? 0) >= 60);
  const unqualifiedResults = results.filter((r) => r.campaignFitScore != null && r.campaignFitScore < 60);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {khSet.iterationNumber}
        </div>
        <h3 className="text-lg font-semibold flex-1">Round {khSet.iterationNumber}</h3>
        <span className="text-sm text-muted-foreground">
          {khSet.keywords.length} kw, {khSet.hashtags.length} ht &middot; {khSet.platform || "both"}
        </span>
        {khSet.status === "failed" && (
          <Button variant="ghost" size="icon" onClick={handleDeleteRound} className="text-muted-foreground hover:text-destructive h-7 w-7">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Step 1: Discovery */}
      <TimelineStep
        title="Discovery"
        status={getDiscoveryStatus()}
        icon={<Search className="h-4 w-4" />}
        summary={resultCount > 0 ? `${resultCount} creators scraped` : undefined}
        onRetry={getDiscoveryStatus() === "failed" ? handleRetryDiscovery : undefined}
        retryLabel="Retry Discovery"
        duration={formatDuration(iteration?.discoveryDuration)}
        defaultExpanded={isLatest && khSet.status === "processing"}
      >
        {logs.length > 0 && (
          <div className="bg-black/90 rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5">
            {logs.map((entry, i) => (
              <div key={i} className={`flex gap-2 ${
                entry.stage === "error" ? "text-red-400" :
                entry.stage === "idle" ? "text-muted-foreground/50" :
                entry.stage.includes("profil") ? "text-purple-400" :
                entry.stage.includes("analysis") || entry.stage.includes("plan") ? "text-cyan-400" :
                entry.stage === "results_batch" || entry.stage === "scraping_complete" ? "text-green-400" :
                "text-foreground"
              }`}>
                <span className="text-muted-foreground flex-shrink-0">
                  [{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                </span>
                <span className="break-words">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </TimelineStep>

      {/* Step 2: Discovered Creators */}
      <TimelineStep
        title="Discovered Creators"
        status={getCreatorsStatus()}
        icon={<Users className="h-4 w-4" />}
        summary={resultCount > 0 ? `${resultCount} creators found` : undefined}
        defaultExpanded={isLatest && getCreatorsStatus() === "completed" && getProfilingStatus() === "pending"}
      >
        {results.length > 0 && (
          <div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Creator</TableHead><TableHead>Platform</TableHead><TableHead>Email</TableHead><TableHead>Followers</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {results.slice(0, 5).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><div className="min-w-0"><p className="text-sm font-medium truncate">{r.creatorName || "Unknown"}</p><p className="text-xs text-muted-foreground">@{r.creatorHandle}</p></div></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.platform === "TIKTOK" ? "TikTok" : "YouTube"}</Badge></TableCell>
                    <TableCell>{r.email ? <span className="text-green-500 text-sm truncate max-w-[150px] flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span> : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatFollowers(r.followers)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {results.length > 5 && (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowAllCreators(true)}>
                <Maximize2 className="h-3 w-3 mr-1" /> View All ({results.length})
              </Button>
            )}
          </div>
        )}
      </TimelineStep>

      {/* Step 3: AI Profiling */}
      <TimelineStep
        title={
          profilingProgressData
            ? `AI Profiling ${profilingProgressData.current}/${profilingProgressData.total}`
            : "AI Profiling"
        }
        status={getProfilingStatus()}
        icon={<Brain className="h-4 w-4" />}
        summary={
          iteration
            ? `${iteration.profiledCount} profiled, ${iteration.skippedCount} skipped. Avg fit: ${Math.round(iteration.avgFitScore ?? 0)}/100`
            : profilingSummaryEvent
            ? profilingSummaryEvent.message
            : undefined
        }
        duration={formatDuration(iteration?.profilingDuration)}
        cost={iteration?.profilingCost ? iteration.profilingCost.toFixed(2) : undefined}
        defaultExpanded={isLatest && getProfilingStatus() === "active"}
        onRetry={getProfilingStatus() === "failed" ? handleRetryProfiling : undefined}
        retryLabel={retrying ? "Retrying..." : "Retry Profiling & Analysis"}
      >
        {/* Progress log during active profiling */}
        {getProfilingStatus() === "active" && (() => {
          const profilingLogs = logs.filter((l) =>
            l.stage.includes("profil") || l.stage.includes("analysis") || l.stage === "scraping_complete"
          );
          return (
            <div className="bg-black/90 rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5">
              {profilingLogs.length === 0 && (
                <p className="text-muted-foreground animate-pulse">AI is evaluating {resultCount} creators against your campaign brief...</p>
              )}
              {profilingLogs.map((entry, i) => (
                <div key={i} className={`flex gap-2 ${
                  entry.stage.includes("complete") || entry.stage.includes("done") ? "text-green-400" :
                  entry.stage.includes("error") ? "text-red-400" :
                  entry.stage.includes("progress") ? "text-purple-400" :
                  "text-cyan-400"
                }`}>
                  <span className="text-muted-foreground flex-shrink-0">
                    [{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                  </span>
                  <span className="break-words">{entry.message}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Completed stats */}
        {iteration && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold">{Math.round(iteration.avgFitScore ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Avg Fit</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold">{iteration.profiledCount}</p>
                <p className="text-xs text-muted-foreground">Profiled</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold">{iteration.skippedCount}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold">{qualifiedResults.length}</p>
                <p className="text-xs text-muted-foreground">Qualified (60+)</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {qualifiedResults.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowQualified(true)}>
                  <Users className="h-3 w-3 mr-1" /> View Qualified Leads ({qualifiedResults.length})
                </Button>
              )}
              {unqualifiedResults.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowUnqualified(true)} className="text-muted-foreground">
                  <Users className="h-3 w-3 mr-1" /> View Unqualified ({unqualifiedResults.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Manual trigger — only when discovery done, profiling hasn't run, campaign not past profiling */}
        {!iteration && isLatest && khSet.status === "completed"
          && !["profiling", "analyzing", "enriching", "awaiting_approval", "iterating"].includes(campaignStatus)
          && !retrying && (
          <Button variant="outline" size="sm" onClick={handleRetryProfiling}>
            <RotateCcw className="h-3 w-3 mr-1" /> Run AI Profiling
          </Button>
        )}
      </TimelineStep>

      {/* Step 4: Email Enrichment */}
      <TimelineStep
        title="Email Enrichment"
        status={getEnrichmentStatus()}
        icon={<Mail className="h-4 w-4" />}
        summary={(() => {
          const er = iteration?.enrichmentResults;
          if (!er) return undefined;
          const entries = Object.values(er);
          const deferred = entries.filter((e) => e.deferred);
          const sent = entries.filter((e) => !e.deferred);
          if (sent.length > 0) {
            const totalSent = sent.reduce((s, e) => s + e.sent, 0);
            return `${totalSent} channels enriched`;
          }
          if (deferred.length > 0) return deferred[0].reason || "Deferred to next round";
          return undefined;
        })()}
        defaultExpanded={isLatest && getEnrichmentStatus() === "active"}
      >
        {/* Enrichment results */}
        {iteration?.enrichmentResults && (() => {
          const er = iteration.enrichmentResults;
          const entries = Object.values(er);
          return (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.workflowId} className="p-2 rounded-lg bg-muted/50 text-sm">
                  {e.deferred ? (
                    <p className="text-muted-foreground">{e.reason}</p>
                  ) : (
                    <p className="text-green-500">{e.sent} channels sent for enrichment</p>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
        {/* Active enrichment */}
        {getEnrichmentStatus() === "active" && !iteration?.enrichmentResults && (
          <div className="p-3 bg-black/90 rounded-lg font-mono text-xs text-purple-400">
            Enrichment in progress — checking qualified leads against available workflows...
          </div>
        )}
      </TimelineStep>

      {/* Step 5: Optimization Plan */}
      <TimelineStep
        title="Optimization Plan"
        status={getOptimizationStatus()}
        icon={<Lightbulb className="h-4 w-4" />}
        summary={iteration?.learnings?.length ? `${iteration.learnings.length} learnings` : undefined}
        defaultExpanded={isLatest && (campaignStatus === "awaiting_approval" || getOptimizationStatus() === "active")}
        paused={isLatest && campaignStatus === "awaiting_approval" && !autoRun}
        isLast
      >
        {iteration?.analysisNarrative && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Analysis</p>
              <p className="text-sm leading-relaxed">{iteration.analysisNarrative}</p>
            </div>
            {iteration.strategyForNext && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Strategy for next round</p>
                <p className="text-sm leading-relaxed text-primary">{iteration.strategyForNext}</p>
              </div>
            )}
            {iteration.learnings.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Learnings</p>
                <ul className="text-sm space-y-1">{iteration.learnings.map((l, i) => <li key={i} className="text-muted-foreground">• {l}</li>)}</ul>
              </div>
            )}
            {iteration.topPerformingKeywords?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {iteration.topPerformingKeywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">{kw}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auto-play timer — only when autoRun is on */}
        {isLatest && campaignStatus === "awaiting_approval" && autoRun && (
          <AutoPlayTimer campaignId={campaignId} onStarted={onRefresh} />
        )}
        {isLatest && campaignStatus === "awaiting_approval" && !autoRun && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
            Auto-run is off. Turn it on to continue automatically, or click Start Now.
            <Button size="sm" className="ml-3" onClick={async () => {
              await fetch(`/api/campaigns/${campaignId}/continue`, { method: "POST" });
              onRefresh();
            }}>Start Next Round</Button>
          </div>
        )}
        {/* Show continue button when campaign stopped but target not met */}
        {isLatest && ["failed", "completed", "aborted"].includes(campaignStatus) && getOptimizationStatus() === "completed" && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm">
            <p className="text-muted-foreground mb-2">Campaign {campaignStatus}. Target not yet reached.</p>
            <Button size="sm" onClick={async () => {
              await fetch(`/api/campaigns/${campaignId}/continue`, { method: "POST" });
              onRefresh();
            }}>
              <Sparkles className="h-3 w-3 mr-1" /> Continue Discovery
            </Button>
          </div>
        )}
      </TimelineStep>

      {/* Modals */}
      <ResultsModal results={results} open={showAllCreators} onClose={() => setShowAllCreators(false)} title="All Discovered Creators" />
      <ResultsModal results={qualifiedResults} open={showQualified} onClose={() => setShowQualified(false)} title="Qualified Leads (Fit ≥ 60)" />
      <ResultsModal results={unqualifiedResults} open={showUnqualified} onClose={() => setShowUnqualified(false)} title="Unqualified Leads (Fit < 60)" />
    </div>
  );
}

// ── Main Campaign Page ──

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [emailCount, setEmailCount] = useState<{ total: number; withEmail: number } | null>(null);
  const [roundResults, setRoundResults] = useState<Map<string, Result[]>>(new Map());
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("llm-provider") as LLMProvider | null;
    if (saved && PROVIDERS.includes(saved)) setProvider(saved);
  }, []);
  const changeProvider = (p: LLMProvider) => {
    setProvider(p); localStorage.setItem("llm-provider", p); setProviderMenuOpen(false);
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${params.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setCampaign(data);
    setNameValue(data.name);

    // Fetch email stats
    fetch(`/api/campaigns/${params.id}/enrichment/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((s) => s && setEmailCount({ total: s.emailStats.total, withEmail: s.emailStats.withEmail }))
      .catch(() => {});

    // Fetch results for each KH set (lightweight — only fields needed for tables)
    for (const set of data.khSets) {
      if (set.status === "completed" || set.status === "processing" || (set._count?.results ?? 0) > 0) {
        const rRes = await fetch(`/api/campaigns/${params.id}/kh-sets/${set.id}`);
        if (rRes.ok) {
          const setData = await rRes.json();
          setRoundResults((prev) => new Map(prev).set(set.id, setData.results || []));
        }
      }
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  // Poll while active
  useEffect(() => {
    if (!campaign) return;
    const active = !["draft", "completed", "aborted", "failed"].includes(campaign.status);
    if (!active) return;
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [campaign, load]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/campaigns/${params.id}/documents`, { method: "POST", body: fd });
    await load(); setUploading(false);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) await uploadFile(file);
  };

  const deleteDocument = async (documentId: string) => {
    await fetch(`/api/campaigns/${params.id}/documents`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId }) });
    await load();
  };

  const deleteCampaign = async () => {
    if (!window.confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/campaigns/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/campaigns");
  };

  const handleAbort = async () => {
    setAborting(true);
    await fetch(`/api/campaigns/${params.id}/abort`, { method: "POST" });
    await load(); setAborting(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await fetch(`/api/campaigns/${params.id}/kh-sets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minKeywords: campaign?.targetKeywords ?? 50, maxKeywords: campaign?.targetKeywords ?? 50, minHashtags: campaign?.targetHashtags ?? 50, maxHashtags: campaign?.targetHashtags ?? 50, provider }),
    });
    await load(); setGenerating(false);
  };

  // Track scroll for sticky header shrink (must be before early returns — hooks can't be conditional)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!campaign) {
    return <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading campaign...</p></div>;
  }

  const hasRuns = campaign.khSets.length > 0;
  const totalLeads = campaign.khSets.filter((s) => s.status === "completed").reduce((sum, s) => sum + (s._count?.results ?? s.totalScraped ?? 0), 0);
  const progress = Math.min(100, Math.round((totalLeads / campaign.targetLeads) * 100));
  const totalCost = (campaign.iterations || []).reduce((s, i) => s + (i.profilingCost ?? 0), 0);
  const isActive = !["draft", "completed", "aborted", "failed"].includes(campaign.status);

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Sticky header with blur */}
      <div className="sticky top-0 z-30 -mx-4 px-4 backdrop-blur-xl bg-background/80 border-b border-border/50 transition-all">
        <div className="max-w-4xl mx-auto">
          {/* Back link — hide when scrolled */}
          {!scrolled && (
            <div className="pt-4 pb-2">
              <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to campaigns
              </Link>
            </div>
          )}

          {/* Title + toggle row */}
          <div className={`flex items-center justify-between transition-all ${scrolled ? "py-3" : "pt-2 pb-3"}`}>
            <div className="min-w-0 flex-1">
              {editingName ? (
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={async () => {
                    if (nameValue.trim() && nameValue !== campaign.name) {
                      await fetch(`/api/campaigns/${params.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: nameValue.trim() }),
                      });
                      await load();
                    }
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setNameValue(campaign.name); setEditingName(false); } }}
                  className={`font-extrabold tracking-tight bg-transparent border-b-2 border-primary outline-none w-full transition-all ${scrolled ? "text-lg" : "text-3xl"}`}
                />
              ) : (
                <h1
                  className={`font-extrabold tracking-tight truncate transition-all cursor-pointer group flex items-center gap-2 ${scrolled ? "text-lg" : "text-3xl"}`}
                  onClick={() => setEditingName(true)}
                >
                  {campaign.name}
                  <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </h1>
              )}
              {!scrolled && (
                <p className="text-lg text-muted-foreground mt-1">{campaign.brandNiche} &middot; {campaign.marketingGoal}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {hasRuns && !["completed", "failed", "aborted"].includes(campaign.status) && (
                <button
                  onClick={async () => {
                    const newVal = !campaign.autoRun;
                    await fetch(`/api/campaigns/${params.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ autoRun: newVal }),
                    });
                    await load();
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    campaign.autoRun
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {campaign.autoRun ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  {scrolled ? "" : `Auto-run ${campaign.autoRun ? "on" : "off"}`}
                </button>
              )}
              {!isActive && !hasRuns && (
                <Button variant="ghost" size="icon" onClick={deleteCampaign} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar — always visible when runs exist */}
          {hasRuns && (
            <div className={`transition-all ${scrolled ? "pb-3" : "pb-4"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className={`font-bold transition-all ${scrolled ? "text-sm" : "text-xl"}`}>
                  {totalLeads.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {campaign.targetLeads.toLocaleString()} leads</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {emailCount && emailCount.total > 0 && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {emailCount.withEmail} emails ({Math.round((emailCount.withEmail / emailCount.total) * 100)}%)
                    </span>
                  )}
                  {totalCost > 0 && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{totalCost.toFixed(2)}</span>}
                  <Badge variant={campaign.status === "completed" ? "default" : campaign.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                    {campaign.status === "awaiting_approval" ? "planning next round" : campaign.status}
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${campaign.status === "completed" ? "bg-green-500" : "bg-primary"} ${isActive ? "animate-pulse" : ""}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacer for sticky header */}
      <div className="h-2" />

      <div className="space-y-6 px-0">

      {/* Timeline */}
      {hasRuns && (
        <div>
          {campaign.khSets
            .sort((a, b) => a.iterationNumber - b.iterationNumber)
            .map((set, idx) => {
              const iteration = campaign.iterations?.find(
                (i) => i.khSetId === set.id
              ) ?? null;

              return (
                <TimelineRound
                  key={set.id}
                  khSet={set}
                  iteration={iteration}
                  campaignId={campaign.id}
                  campaignStatus={campaign.status}
                  isLatest={idx === campaign.khSets.length - 1}
                  results={roundResults.get(set.id) || []}
                  onRefresh={load}
                  autoRun={campaign.autoRun}
                />
              );
            })}
        </div>
      )}

      {/* Draft state: document upload + start discovery */}
      {campaign.status === "draft" && (
        <>
          <Separator />

          {campaign.documents.length > 0 && (
            <div className="space-y-2">
              {campaign.documents.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  {getFileIcon(d.filename)}
                  <span className="text-sm font-medium flex-1">{d.filename}</span>
                  <span className="text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>
                  <button onClick={() => deleteDocument(d.id)} className="ml-1 p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.md,.txt" multiple className="hidden" onChange={handleFileInput} disabled={uploading} />
            {uploading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> : (
              <div className="flex flex-col items-center gap-1"><Upload className="h-6 w-6 text-muted-foreground/50" /><p className="text-sm font-medium">Drop files or click to browse</p></div>
            )}
          </div>

          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2"><Target className="h-4 w-4" /> Target: {campaign.targetLeads.toLocaleString()} leads</p>
                  <p className="text-sm text-muted-foreground">{campaign.documents.length} document{campaign.documents.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-0">
                  <Button onClick={handleGenerate} disabled={generating || campaign.documents.length === 0} size="lg" className="rounded-r-none">
                    {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Start Discovery</>}
                  </Button>
                  <div className="relative">
                    <Button variant="default" size="lg" className="rounded-l-none border-l border-l-primary-foreground/20 px-3" onClick={() => setProviderMenuOpen(!providerMenuOpen)} disabled={generating}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    {providerMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setProviderMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-popover p-1 shadow-md">
                          {PROVIDERS.map((p) => (
                            <button key={p} onClick={() => changeProvider(p)} className={`w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${p === provider ? "bg-accent font-medium" : "hover:bg-accent"}`}>
                              {PROVIDER_LABELS[p]}{p === provider && " ✓"}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>{/* close space-y-6 wrapper */}
    </div>
  );
}
