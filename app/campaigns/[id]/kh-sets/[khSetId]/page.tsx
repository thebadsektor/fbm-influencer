"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Rocket,
  Sparkles,
  Loader2,
  X,
  Plus,
  RotateCcw,
  CircleStop,
  Youtube,
  Music2,
  Layers,
  FlaskConical,
  ShoppingBag,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Mail,
  Users,
  ExternalLink,
  DollarSign,
  Clock,
  Brain,
} from "lucide-react";
import ImportBasketDialog from "@/components/dashboard/ImportBasketDialog";
import type { BasketItem } from "@/lib/basket";
import { IDLE_MESSAGES } from "@/lib/idle-messages";

// ── Types ──

interface Result {
  id: string;
  platform: string;
  platformId: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  profileUrl: string | null;
  email: string | null;
  emailSource: string | null;
  followers: string | null;
  engagementRate: string | null;
  bio: string | null;
  hashtags: string | null;
  avatar: string | null;
}

interface IterationData {
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
}

interface KHSet {
  id: string;
  keywords: string[];
  hashtags: string[];
  locked: boolean;
  status: string;
  platform: string | null;
  parentSetId: string | null;
  iterationNumber: number;
  createdAt: string;
  totalScraped: number;
  qualified: number;
  disqualified: number;
  missingEmail: number;
  enriched: number;
  leadPoolUrl: string | null;
  extraStats: Record<string, number>;
  lastSyncedAt: string | null;
  results: Result[];
  campaignStatus?: string;
  iteration?: IterationData;
}

interface LogEntry {
  stage: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ── Live Log Component ──

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function LiveLog({
  khSetId,
  isActive,
  logs,
  setLogs,
}: {
  khSetId: string;
  isActive: boolean;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}) {
  const [sseConnected, setSseConnected] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const lastRealEventRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Single stable effect — opens SSE once per khSetId, manages lifecycle via refs
  useEffect(() => {
    const params = window.location.pathname.split("/");
    const campaignId = params[2];
    const url = `/api/campaigns/${campaignId}/kh-sets/${khSetId}/stream`;

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (!isActiveRef.current) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setSseConnected(true);

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        if (entry.stage === "connected") {
          setSseConnected(true);
          // Only show first connected message
          setLogs((prev) => prev.some((l) => l.stage === "connected") ? prev : [...prev, entry]);
          return;
        }
        lastRealEventRef.current = Date.now();
        setLogs((prev) => [...prev, entry]);
      } catch {
        // Skip unparseable (heartbeats)
      }
    };

    es.onerror = () => {
      // Don't toggle connected state on every error — EventSource auto-reconnects
      // Only mark disconnected if we've been erroring for a while
    };

    // Idle timer
    idleTimerRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      const elapsed = Math.round((Date.now() - lastRealEventRef.current) / 1000);
      if (elapsed >= 30) {
        const msg = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)];
        setLogs((prev) => [
          ...prev,
          {
            stage: "idle",
            message: `${msg} (${formatElapsed(elapsed)} since last update)`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }, 30000);

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setSseConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khSetId]);

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return ""; }
  };

  const stageColor = (stage: string) => {
    if (stage === "completed" || stage === "results_received" || stage === "campaign_completed" || stage === "memory_saved") return "text-green-400";
    if (stage === "error") return "text-red-400";
    if (stage === "started" || stage === "iteration_started") return "text-blue-400";
    if (stage === "profiling_started" || stage === "profiling_progress" || stage === "profiling_completed") return "text-purple-400";
    if (stage === "analysis_started" || stage === "analysis_completed") return "text-cyan-400";
    if (stage === "stats_update") return "text-yellow-400";
    if (stage === "idle") return "text-muted-foreground/50";
    if (stage === "connected") return "text-muted-foreground";
    return "text-foreground";
  };

  const stageIcon = (stage: string) => {
    if (stage === "completed" || stage === "campaign_completed" || stage === "memory_saved") return "\u2713";
    if (stage === "error") return "\u2717";
    if (stage === "started" || stage === "iteration_started") return "\u25B6";
    if (stage.startsWith("profiling")) return "\u2691";
    if (stage.startsWith("analysis")) return "\u2690";
    if (stage === "idle") return "\u00B7";
    if (stage === "connected") return "\u25CF";
    return "\u2022";
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2 w-2 rounded-full ${sseConnected ? "bg-green-500" : "bg-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">
          {sseConnected ? "Live feed" : isActive ? "Connecting..." : "Feed closed"}
        </span>
      </div>
      <div
        ref={logRef}
        className="flex-1 bg-black/90 rounded-lg p-4 font-mono text-xs overflow-y-auto max-h-72 min-h-48 space-y-1"
      >
        {logs.length === 0 && isActive && (
          <p className="text-muted-foreground animate-pulse">Waiting for events...</p>
        )}
        {logs.map((entry, i) => (
          <div key={i} className={`flex gap-2 ${stageColor(entry.stage)}`}>
            <span className="text-muted-foreground flex-shrink-0">[{formatTime(entry.timestamp)}]</span>
            <span className="flex-shrink-0">{stageIcon(entry.stage)}</span>
            <span className="break-words">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Results Table Component ──

function ResultsPreview({ results }: { results: Result[] }) {
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 25;
  const preview = results.slice(0, 5);
  const totalPages = Math.ceil(results.length / perPage);
  const pageResults = results.slice(page * perPage, (page + 1) * perPage);

  const formatFollowers = (f: string | null) => {
    if (!f) return "-";
    const n = parseInt(f);
    if (isNaN(n)) return f;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  };

  const ResultRow = ({ r, compact }: { r: Result; compact?: boolean }) => (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {r.avatar && <img src={r.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{r.creatorName || "Unknown"}</p>
            <p className="text-xs text-muted-foreground truncate">@{r.creatorHandle || "?"}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {r.platform === "TIKTOK" ? "TikTok" : r.platform === "YOUTUBE" ? "YouTube" : r.platform}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {r.email ? (
          <span className="flex items-center gap-1 text-green-500">
            <Mail className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{r.email}</span>
          </span>
        ) : <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell className="text-sm tabular-nums">{formatFollowers(r.followers)}</TableCell>
      {!compact && (
        <>
          <TableCell className="text-sm tabular-nums">{r.engagementRate ? `${r.engagementRate}%` : "-"}</TableCell>
          <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
            {r.bio ? r.bio.slice(0, 100) + (r.bio.length > 100 ? "..." : "") : "-"}
          </TableCell>
          <TableCell>
            {r.profileUrl && (
              <a href={r.profileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-7 px-2"><ExternalLink className="h-3 w-3" /></Button>
              </a>
            )}
          </TableCell>
        </>
      )}
    </TableRow>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5" /> Discovered Creators <Badge variant="secondary">{results.length}</Badge>
            </CardTitle>
            {results.length > 5 && (
              <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                <Maximize2 className="h-4 w-4 mr-1" /> View All ({results.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No results yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Creator</TableHead><TableHead>Platform</TableHead><TableHead>Email</TableHead><TableHead>Followers</TableHead>
              </TableRow></TableHeader>
              <TableBody>{preview.map((r) => <ResultRow key={r.id} r={r} compact />)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> All Discovered Creators <Badge variant="secondary">{results.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Creator</TableHead><TableHead>Platform</TableHead><TableHead>Email</TableHead>
                <TableHead>Followers</TableHead><TableHead>Engagement</TableHead><TableHead>Bio</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>{pageResults.map((r) => <ResultRow key={r.id} r={r} />)}</TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages} ({results.length} total)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Iteration Intelligence Card ──

function IterationInsights({ iteration }: { iteration: IterationData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-purple-500" /> AI Intelligence Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {iteration.avgFitScore != null && (
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{Math.round(iteration.avgFitScore)}</p>
              <p className="text-xs text-muted-foreground">Avg Fit Score</p>
            </div>
          )}
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{iteration.profiledCount}</p>
            <p className="text-xs text-muted-foreground">Profiled</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{iteration.skippedCount}</p>
            <p className="text-xs text-muted-foreground">Skipped (no data)</p>
          </div>
          {iteration.profilingCost != null && iteration.profilingCost > 0 && (
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold flex items-center justify-center gap-1">
                <DollarSign className="h-4 w-4" />{iteration.profilingCost.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">AI Cost</p>
            </div>
          )}
        </div>

        {/* Duration */}
        {(iteration.discoveryDuration || iteration.profilingDuration) && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {iteration.discoveryDuration && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Scrape: {Math.round(iteration.discoveryDuration / 60)}m {iteration.discoveryDuration % 60}s</span>
            )}
            {iteration.profilingDuration && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Profiling: {iteration.profilingDuration}s</span>
            )}
          </div>
        )}

        {/* Top keywords */}
        {iteration.topPerformingKeywords.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Top performing keywords</p>
            <div className="flex flex-wrap gap-1">
              {iteration.topPerformingKeywords.map((kw) => (
                <span key={kw} className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">{kw}</span>
              ))}
            </div>
          </div>
        )}

        {/* Analysis narrative */}
        {iteration.analysisNarrative && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Analysis</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{iteration.analysisNarrative}</p>
          </div>
        )}

        {/* Strategy */}
        {iteration.strategyForNext && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Strategy for next round</p>
            <p className="text-sm leading-relaxed">{iteration.strategyForNext}</p>
          </div>
        )}

        {/* Learnings */}
        {iteration.learnings.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Learnings</p>
            <ul className="text-sm space-y-1">
              {iteration.learnings.map((l, i) => <li key={i} className="text-muted-foreground">• {l}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function KHSetDetailPage() {
  const params = useParams();
  const [set, setSet] = useState<KHSet | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newHashtag, setNewHashtag] = useState("");
  const [platform, setPlatform] = useState("both");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [importKwOpen, setImportKwOpen] = useState(false);
  const [importHtOpen, setImportHtOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}`);
    if (res.ok) setSet(await res.json());
  }, [params.id, params.khSetId]);

  useEffect(() => { load(); }, [load]);

  // Poll while any active phase
  useEffect(() => {
    if (!set) return;
    const isActive = set.status === "processing" ||
      ["profiling", "analyzing", "iterating", "discovering"].includes(set.campaignStatus || "");
    if (!isActive) return;
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [set, load]);

  // Auto-collapse log when all phases end
  useEffect(() => {
    if (!set) return;
    const isDone = set.status === "completed" &&
      !["profiling", "analyzing", "iterating"].includes(set.campaignStatus || "");
    if (isDone && logs.length > 0) setLogCollapsed(true);
  }, [set, logs.length]);

  const isActive = set
    ? set.status === "processing" ||
      ["profiling", "analyzing", "iterating", "discovering"].includes(set.campaignStatus || "")
    : false;

  const save = async (keywords: string[], hashtags: string[]) => {
    setSaving(true);
    await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, hashtags }),
    });
    await load(); setSaving(false);
  };

  const addKeyword = () => { if (!newKeyword.trim() || !set) return; save([...set.keywords, newKeyword.trim()], set.hashtags); setNewKeyword(""); };
  const removeKeyword = (kw: string) => { if (!set) return; save(set.keywords.filter((k) => k !== kw), set.hashtags); };
  const addHashtag = () => {
    if (!newHashtag.trim() || !set) return;
    const tag = newHashtag.trim().startsWith("#") ? newHashtag.trim() : `#${newHashtag.trim()}`;
    save(set.keywords, [...set.hashtags, tag]); setNewHashtag("");
  };
  const removeHashtag = (ht: string) => { if (!set) return; save(set.keywords, set.hashtags.filter((h) => h !== ht)); };

  const handleRunDiscovery = async () => {
    setSubmitting(true);
    await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, testMode }),
    });
    await load(); setSubmitting(false);
  };

  const handleReset = async () => {
    await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}/reset`, { method: "POST" });
    await load();
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    const res = await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}/optimize`, { method: "POST" });
    if (res.ok) { const newSet = await res.json(); window.location.href = `/campaigns/${params.id}/kh-sets/${newSet.id}`; }
    setOptimizing(false);
  };

  if (!set) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isEditable = set.status === "draft";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href={`/campaigns/${params.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to campaign
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">
            {set.status === "processing" ? "Scouting in Progress" : set.status === "completed" ? "Scouts Are Back!" : "Campaign Keywords and Hashtags"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Round {set.iterationNumber} &middot; Created {new Date(set.createdAt).toLocaleString()}
            {set.parentSetId && " \u00b7 Optimized from previous set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const cs = set.campaignStatus || "";
            const isPostScrape = ["profiling", "analyzing", "iterating"].includes(cs);
            if (set.status === "completed" && isPostScrape) {
              return (
                <>
                  <Badge variant="outline" className="text-sm px-3 py-1">scraping done</Badge>
                  <Badge variant="secondary" className="text-sm px-3 py-1 animate-pulse">
                    {cs === "profiling" ? "AI profiling..." : cs === "analyzing" ? "analyzing results..." : "preparing next round..."}
                  </Badge>
                </>
              );
            }
            if (set.status === "completed" && (!cs || ["completed", "draft"].includes(cs))) {
              return <Badge variant="default" className="text-sm px-3 py-1">completed</Badge>;
            }
            return (
              <Badge variant={set.status === "failed" ? "destructive" : "secondary"} className="text-sm px-3 py-1">
                {set.status === "processing" ? "scraping..." : set.status}
              </Badge>
            );
          })()}
        </div>
      </div>

      {/* Keywords/Hashtags (editable in draft, compact summary otherwise) */}
      {isEditable ? (
        <>
          <div>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mb-4">
              Keywords <span className="text-lg font-normal text-muted-foreground ml-2">({set.keywords.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {set.keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Add keyword..." onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())} />
              <Button variant="outline" onClick={addKeyword} disabled={saving}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              <Button variant="outline" onClick={() => setImportKwOpen(true)}><ShoppingBag className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mb-4">
              Hashtags <span className="text-lg font-normal text-muted-foreground ml-2">({set.hashtags.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {set.hashtags.map((ht) => (
                <span key={ht} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm font-medium">
                  {ht}
                  <button onClick={() => removeHashtag(ht)} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newHashtag} onChange={(e) => setNewHashtag(e.target.value)} placeholder="Add hashtag..." onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())} />
              <Button variant="outline" onClick={addHashtag} disabled={saving}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              <Button variant="outline" onClick={() => setImportHtOpen(true)}><ShoppingBag className="h-4 w-4" /></Button>
            </div>
          </div>
          <Separator />
        </>
      ) : (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{set.keywords.length} keywords</span><span>&middot;</span>
          <span>{set.hashtags.length} hashtags</span><span>&middot;</span>
          <span>Platform: {set.platform || "both"}</span>
        </div>
      )}

      {/* Run Discovery (draft only) */}
      {set.status === "draft" && (
        <Card>
          <CardHeader><CardTitle>Run Discovery</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button variant={platform === "youtube" ? "default" : "outline"} size="sm" onClick={() => setPlatform("youtube")}><Youtube className="h-4 w-4 mr-1.5" /> YouTube</Button>
                <Button variant={platform === "tiktok" ? "default" : "outline"} size="sm" onClick={() => setPlatform("tiktok")}><Music2 className="h-4 w-4 mr-1.5" /> TikTok</Button>
                <Button variant={platform === "both" ? "default" : "outline"} size="sm" onClick={() => setPlatform("both")}><Layers className="h-4 w-4 mr-1.5" /> All</Button>
              </div>
              <Button variant={testMode ? "default" : "outline"} size="sm" onClick={() => setTestMode(!testMode)} className={testMode ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}>
                <FlaskConical className="h-4 w-4 mr-1.5" /> Test
              </Button>
            </div>
            <Button onClick={handleRunDiscovery} disabled={submitting} className="w-full" size="lg">
              {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</>) : (<><Rocket className="h-4 w-4 mr-2" /> Run Discovery</>)}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Live Log — visible during processing AND profiling/analyzing, collapsible after */}
      {(isActive || logs.length > 0) && (
        <Card>
          <CardHeader
            className="py-3 cursor-pointer"
            onClick={() => !isActive && setLogCollapsed(!logCollapsed)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Progress Log
                <Badge variant="outline" className="text-xs">{logs.length} events</Badge>
                {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
              </CardTitle>
              {!isActive && logs.length > 0 && (
                <ChevronDown className={`h-4 w-4 transition-transform ${logCollapsed ? "-rotate-90" : ""}`} />
              )}
            </div>
          </CardHeader>
          {(!logCollapsed || isActive) && (
            <CardContent className="pt-0">
              <div className="flex items-start gap-6">
                {isActive && (
                  <div className="flex-shrink-0 text-center">
                    <img src="/scouting-loading.gif" alt="Scouting" className="h-36 w-36 rounded-lg"
                      onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary hidden" />
                  </div>
                )}
                <LiveLog khSetId={set.id} isActive={isActive} logs={logs} setLogs={setLogs} />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Completed: Results + Intelligence */}
      {set.status === "completed" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">{set.results.length} creators discovered</p>
            <Button onClick={handleOptimize} disabled={optimizing} variant="outline" size="lg">
              {optimizing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Optimizing...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Optimize KH Set</>)}
            </Button>
          </div>

          {/* AI Intelligence Report */}
          {set.iteration && (set.iteration.profiledCount > 0 || set.iteration.analysisNarrative) && (
            <IterationInsights iteration={set.iteration} />
          )}

          <ResultsPreview results={set.results} />
        </div>
      )}

      {/* Failed */}
      {set.status === "failed" && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4 space-y-3">
              <p className="text-lg font-semibold text-destructive">Something Went Wrong</p>
              <p className="text-sm text-muted-foreground">Our scouts couldn&apos;t reach base camp. Give it another shot!</p>
              <Button variant="outline" size="sm" onClick={handleRunDiscovery} disabled={submitting}>
                {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Retrying...</>) : (<><RotateCcw className="h-4 w-4 mr-2" /> Retry</>)}
              </Button>
              <div><Button variant="ghost" size="sm" onClick={handleReset}><CircleStop className="h-4 w-4 mr-2" /> Cancel</Button></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Basket Dialogs */}
      <ImportBasketDialog open={importKwOpen} onClose={() => setImportKwOpen(false)} filterTypes={["keyword"]}
        onImport={(items: BasketItem[]) => { if (!set) return; const merged = [...new Set([...set.keywords, ...items.map(i => i.label)])]; save(merged, set.hashtags); }} />
      <ImportBasketDialog open={importHtOpen} onClose={() => setImportHtOpen(false)} filterTypes={["hashtag"]}
        onImport={(items: BasketItem[]) => { if (!set) return; const newHts = items.map(i => i.label.startsWith("#") ? i.label : `#${i.label}`); const merged = [...new Set([...set.hashtags, ...newHts])]; save(set.keywords, merged); }} />
    </div>
  );
}
