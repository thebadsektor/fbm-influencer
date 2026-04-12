"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  Mail,
  Users,
  ExternalLink,
} from "lucide-react";
import ImportBasketDialog from "@/components/dashboard/ImportBasketDialog";
import type { BasketItem } from "@/lib/basket";

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
}

interface LogEntry {
  stage: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ── Live Log Component ──

function LiveLog({ khSetId, isProcessing }: { khSetId: string; isProcessing: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProcessing) return;

    const params = window.location.pathname.split("/");
    const campaignId = params[2]; // /campaigns/[id]/kh-sets/[khSetId]
    const url = `/api/campaigns/${campaignId}/kh-sets/${khSetId}/stream`;

    let es: EventSource | null = null;
    try {
      es = new EventSource(url);

      es.onopen = () => setSseConnected(true);

      es.onmessage = (event) => {
        try {
          const entry: LogEntry = JSON.parse(event.data);
          setLogs((prev) => [...prev, entry]);
        } catch {
          // Skip unparseable events (heartbeats)
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        // EventSource auto-reconnects
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      es?.close();
      setSseConnected(false);
    };
  }, [khSetId, isProcessing]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "";
    }
  };

  const stageIcon = (stage: string) => {
    if (stage === "completed") return "\u2713";
    if (stage === "error") return "\u2717";
    if (stage === "started") return "\u25B6";
    if (stage === "connected") return "\u25CF";
    return "\u2022";
  };

  const stageColor = (stage: string) => {
    if (stage === "completed" || stage === "results_received") return "text-green-400";
    if (stage === "error") return "text-red-400";
    if (stage === "started") return "text-blue-400";
    if (stage === "connected") return "text-muted-foreground";
    if (stage === "stats_update") return "text-yellow-400";
    return "text-foreground";
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2 w-2 rounded-full ${sseConnected ? "bg-green-500" : "bg-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">
          {sseConnected ? "Live feed" : "Connecting..."}
        </span>
      </div>
      <div
        ref={logRef}
        className="flex-1 bg-black/90 rounded-lg p-4 font-mono text-xs overflow-y-auto max-h-72 min-h-48 space-y-1"
      >
        {logs.length === 0 && (
          <p className="text-muted-foreground animate-pulse">Waiting for events...</p>
        )}
        {logs.map((entry, i) => (
          <div key={i} className={`flex gap-2 ${stageColor(entry.stage)}`}>
            <span className="text-muted-foreground flex-shrink-0">[{formatTime(entry.timestamp)}]</span>
            <span className="flex-shrink-0">{stageIcon(entry.stage)}</span>
            <span>{entry.message}</span>
          </div>
        ))}
        {isProcessing && logs.length > 0 && (
          <div className="flex gap-2 text-muted-foreground animate-pulse">
            <span className="flex-shrink-0">&nbsp;&nbsp;</span>
            <span>...</span>
          </div>
        )}
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
          {r.avatar && (
            <img src={r.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          )}
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
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-sm tabular-nums">{formatFollowers(r.followers)}</TableCell>
      {!compact && (
        <>
          <TableCell className="text-sm tabular-nums">{r.engagementRate ? `${r.engagementRate}%` : "-"}</TableCell>
          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
            {r.bio ? r.bio.slice(0, 80) + (r.bio.length > 80 ? "..." : "") : "-"}
          </TableCell>
          <TableCell>
            {r.profileUrl && (
              <a href={r.profileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <ExternalLink className="h-3 w-3" />
                </Button>
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
              <Users className="h-5 w-5" />
              Discovered Creators
              <Badge variant="secondary">{results.length}</Badge>
            </CardTitle>
            {results.length > 5 && (
              <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                <Maximize2 className="h-4 w-4 mr-1" />
                View All ({results.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No results yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Followers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r) => (
                  <ResultRow key={r.id} r={r} compact />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Discovered Creators
              <Badge variant="secondary">{results.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Bio</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.map((r) => (
                  <ResultRow key={r.id} r={r} />
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages} ({results.length} total)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ──

export default function KHSetDetailPage() {
  const params = useParams();
  const [set, setSet] = useState<KHSet | null>(null);
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

  // Keep polling as fallback (SSE is primary but polling catches missed events)
  useEffect(() => {
    if (!set || set.status !== "processing") return;
    const interval = setInterval(load, 10000); // Slower poll since SSE handles real-time
    return () => clearInterval(interval);
  }, [set, load]);

  const save = async (keywords: string[], hashtags: string[]) => {
    setSaving(true);
    await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, hashtags }),
    });
    await load();
    setSaving(false);
  };

  const addKeyword = () => {
    if (!newKeyword.trim() || !set) return;
    save([...set.keywords, newKeyword.trim()], set.hashtags);
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    if (!set) return;
    save(set.keywords.filter((k) => k !== kw), set.hashtags);
  };

  const addHashtag = () => {
    if (!newHashtag.trim() || !set) return;
    const tag = newHashtag.trim().startsWith("#") ? newHashtag.trim() : `#${newHashtag.trim()}`;
    save(set.keywords, [...set.hashtags, tag]);
    setNewHashtag("");
  };

  const removeHashtag = (ht: string) => {
    if (!set) return;
    save(set.keywords, set.hashtags.filter((h) => h !== ht));
  };

  const handleRunDiscovery = async () => {
    setSubmitting(true);
    await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, testMode }),
    });
    await load();
    setSubmitting(false);
  };

  const handleReset = async () => {
    await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}/reset`, { method: "POST" });
    await load();
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    const res = await fetch(`/api/campaigns/${params.id}/kh-sets/${params.khSetId}/optimize`, { method: "POST" });
    if (res.ok) {
      const newSet = await res.json();
      window.location.href = `/campaigns/${params.id}/kh-sets/${newSet.id}`;
    }
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
      <Link
        href={`/campaigns/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaign
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
        <Badge
          variant={set.status === "completed" ? "default" : set.status === "failed" ? "destructive" : "secondary"}
          className="text-sm px-3 py-1"
        >
          {set.status}
        </Badge>
      </div>

      {/* Keywords (collapsed when not draft) */}
      {isEditable && (
        <>
          <div>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mb-4">
              Keywords <span className="text-lg font-normal text-muted-foreground ml-2">({set.keywords.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {set.keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
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
                  <button onClick={() => removeHashtag(ht)} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
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
      )}

      {/* Non-draft: show keywords/hashtags as compact summary */}
      {!isEditable && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{set.keywords.length} keywords</span>
          <span>&middot;</span>
          <span>{set.hashtags.length} hashtags</span>
          <span>&middot;</span>
          <span>Platform: {set.platform || "both"}</span>
        </div>
      )}

      {/* Run Discovery (draft only) */}
      {set.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Run Discovery</CardTitle>
            <CardDescription>Pick your platform and send the scouts out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button variant={platform === "youtube" ? "default" : "outline"} size="sm" onClick={() => setPlatform("youtube")}>
                  <Youtube className="h-4 w-4 mr-1.5" /> YouTube
                </Button>
                <Button variant={platform === "tiktok" ? "default" : "outline"} size="sm" onClick={() => setPlatform("tiktok")}>
                  <Music2 className="h-4 w-4 mr-1.5" /> TikTok
                </Button>
                <Button variant={platform === "both" ? "default" : "outline"} size="sm" onClick={() => setPlatform("both")}>
                  <Layers className="h-4 w-4 mr-1.5" /> All
                </Button>
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

      {/* Processing: GIF + Live Log */}
      {set.status === "processing" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              {/* Left — GIF */}
              <div className="flex-shrink-0 text-center">
                <img
                  src="/scouting-loading.gif"
                  alt="Scouting in progress"
                  className="h-36 w-36 rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary hidden" />
              </div>

              {/* Right — Live Log */}
              <LiveLog khSetId={set.id} isProcessing={set.status === "processing"} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      {set.status === "completed" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">{set.results.length} creators discovered</p>
            <Button onClick={handleOptimize} disabled={optimizing} variant="outline" size="lg">
              {optimizing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Optimizing...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Optimize KH Set</>)}
            </Button>
          </div>

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
              <div>
                <Button variant="ghost" size="sm" onClick={handleReset}><CircleStop className="h-4 w-4 mr-2" /> Cancel</Button>
              </div>
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
