"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LLMProvider } from "@/lib/llm";
import { PROVIDER_LABELS } from "@/lib/llm";
import {
  ArrowLeft,
  Upload,
  FileText,
  FileCode,
  File,
  Sparkles,
  Loader2,
  ChevronDown,
  X,
  Trash2,
  Users,
  Target,
  StopCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "gemini"];

interface KHSetSummary {
  id: string;
  status: string;
  locked: boolean;
  keywords: string[];
  hashtags: string[];
  iterationNumber: number;
  createdAt: string;
  _count?: { results: number };
  totalScraped: number;
}

interface IterationSummary {
  id: string;
  iterationNumber: number;
  resultsCount: number;
  profiledCount: number;
  skippedCount: number;
  avgFitScore: number | null;
  fitDistribution: Record<string, number> | null;
  topPerformingKeywords: string[];
  lowPerformingKeywords: string[];
  analysisNarrative: string | null;
  strategyForNext: string | null;
  learnings: string[];
  profilingCost: number | null;
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
  documents: { id: string; filename: string; createdAt: string }[];
  khSets: KHSetSummary[];
  iterations: IterationSummary[];
}

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (filename.endsWith(".md")) return <FileCode className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "completed": return "default" as const;
    case "failed": case "aborted": return "destructive" as const;
    case "discovering": case "iterating": case "processing": case "profiling": case "analyzing": return "secondary" as const;
    default: return "outline" as const;
  }
}

function ProgressView({ campaign, onAbort, onRefresh }: {
  campaign: Campaign;
  onAbort: () => void;
  onRefresh: () => void;
}) {
  const totalLeads = campaign.khSets
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + (s.totalScraped || (s._count?.results ?? 0)), 0);
  const progress = Math.min(100, Math.round((totalLeads / campaign.targetLeads) * 100));
  const totalCost = (campaign.iterations || []).reduce(
    (sum, i) => sum + (i.profilingCost ?? 0), 0
  );
  const isRunning = ["discovering", "iterating", "aborting", "profiling", "analyzing"].includes(campaign.status);
  const isProcessing = campaign.khSets.some((s) => s.status === "processing");

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Discovery Progress</p>
              <p className="text-3xl font-bold">
                {totalLeads.toLocaleString()} <span className="text-lg font-normal text-muted-foreground">/ {campaign.targetLeads.toLocaleString()} leads</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {campaign.status === "completed" && (
                <Badge variant="default" className="text-sm gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </Badge>
              )}
              {campaign.status === "aborting" && (
                <Badge variant="secondary" className="text-sm gap-1 animate-pulse">
                  <Clock className="h-3 w-3" /> Stopping after current run...
                </Badge>
              )}
              {campaign.status === "aborted" && (
                <Badge variant="destructive" className="text-sm gap-1">
                  <StopCircle className="h-3 w-3" /> Aborted
                </Badge>
              )}
              {campaign.status === "failed" && (
                <Badge variant="destructive" className="text-sm gap-1">
                  <AlertCircle className="h-3 w-3" /> Failed
                </Badge>
              )}
              {isRunning && campaign.status !== "aborting" && (
                <Button variant="destructive" size="sm" onClick={onAbort}>
                  <StopCircle className="h-4 w-4 mr-1" /> Abort
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                campaign.status === "completed"
                  ? "bg-green-500"
                  : campaign.status === "failed" || campaign.status === "aborted"
                  ? "bg-destructive"
                  : "bg-primary"
              } ${isProcessing ? "animate-pulse" : ""}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {progress}% complete &middot; {campaign.khSets.filter((s) => s.status === "completed").length} rounds completed
            {totalCost > 0 && ` \u00b7 AI cost: $${totalCost.toFixed(2)}`}
            {isProcessing && " \u00b7 Scraping..."}
            {campaign.status === "profiling" && " \u00b7 AI profiling creators..."}
            {campaign.status === "analyzing" && " \u00b7 Analyzing results..."}
          </p>
        </CardContent>
      </Card>

      {/* Iteration List with Intelligence */}
      <div>
        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mb-3">Discovery Rounds</h3>
        <div className="space-y-3">
          {campaign.khSets
            .sort((a, b) => a.iterationNumber - b.iterationNumber)
            .map((set) => {
              const iteration = campaign.iterations?.find(
                (i) => i.iterationNumber === set.iterationNumber
              );
              return (
                <div key={set.id} className="rounded-lg border overflow-hidden">
                  <Link href={`/campaigns/${campaign.id}/kh-sets/${set.id}`} className="block">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-bold">
                          {set.iterationNumber}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Round {set.iterationNumber} &middot; {set.keywords.length} kw, {set.hashtags.length} ht
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {set.status === "completed"
                              ? `${set.totalScraped || set._count?.results || 0} leads`
                              : set.status === "processing"
                              ? "Scraping..."
                              : set.status}
                            {iteration?.avgFitScore != null && (
                              <span className={`ml-2 ${iteration.avgFitScore >= 50 ? "text-green-500" : iteration.avgFitScore >= 25 ? "text-yellow-500" : "text-red-400"}`}>
                                Fit: {Math.round(iteration.avgFitScore)}/100
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant={statusBadgeVariant(set.status)}>
                        {set.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {set.status}
                      </Badge>
                    </div>
                  </Link>

                  {/* Iteration Intelligence (if available) */}
                  {iteration && (
                    <div className="px-4 pb-4 pt-0 border-t bg-muted/10 space-y-2">
                      {iteration.learnings.length > 0 && (
                        <div className="text-xs space-y-1">
                          {iteration.learnings.slice(0, 3).map((l, i) => (
                            <p key={i} className="text-muted-foreground">• {l}</p>
                          ))}
                        </div>
                      )}
                      {iteration.topPerformingKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {iteration.topPerformingKeywords.slice(0, 5).map((kw) => (
                            <span key={kw} className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                      {iteration.analysisNarrative && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          {iteration.analysisNarrative}
                        </p>
                      )}
                      {(iteration.profilingCost != null && iteration.profilingCost > 0) && (
                        <p className="text-xs text-muted-foreground">
                          AI cost: ${iteration.profilingCost.toFixed(3)} &middot; {iteration.profiledCount} profiled, {iteration.skippedCount} skipped
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aborting, setAborting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Provider state
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("llm-provider") as LLMProvider | null;
    if (saved && PROVIDERS.includes(saved)) setProvider(saved);
  }, []);
  const changeProvider = (p: LLMProvider) => {
    setProvider(p);
    localStorage.setItem("llm-provider", p);
    setProviderMenuOpen(false);
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${params.id}`);
    if (res.ok) setCampaign(await res.json());
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  // Poll while discovering/iterating
  useEffect(() => {
    if (!campaign) return;
    const isActive = ["discovering", "iterating", "aborting", "profiling", "analyzing"].includes(campaign.status) ||
      campaign.khSets.some((s) => s.status === "processing");
    if (!isActive) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [campaign, load]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/campaigns/${params.id}/documents`, { method: "POST", body: fd });
    await load();
    setUploading(false);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) await uploadFile(file);
  };

  const deleteDocument = async (documentId: string) => {
    await fetch(`/api/campaigns/${params.id}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    await load();
  };

  const deleteCampaign = async () => {
    if (!window.confirm("Delete this campaign? This will also remove all documents, KH sets, and results.")) return;
    const res = await fetch(`/api/campaigns/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/campaigns");
  };

  const handleAbort = async () => {
    setAborting(true);
    await fetch(`/api/campaigns/${params.id}/abort`, { method: "POST" });
    await load();
    setAborting(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/campaigns/${params.id}/kh-sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minKeywords: campaign?.targetKeywords ?? 50,
        maxKeywords: campaign?.targetKeywords ?? 50,
        minHashtags: campaign?.targetHashtags ?? 50,
        maxHashtags: campaign?.targetHashtags ?? 50,
        provider,
      }),
    });
    if (res.ok) {
      const set = await res.json();
      router.push(`/campaigns/${params.id}/kh-sets/${set.id}`);
    }
    setGenerating(false);
  };

  if (!campaign) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading campaign...</p>
      </div>
    );
  }

  const hasRuns = campaign.khSets.length > 0;
  const isActive = ["discovering", "iterating", "aborting", "profiling", "analyzing"].includes(campaign.status) ||
    campaign.khSets.some((s) => s.status === "processing");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">{campaign.name}</h1>
          <p className="text-xl text-muted-foreground mt-1">
            {campaign.brandNiche} &middot; {campaign.marketingGoal}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(campaign.status)} className="text-sm">
            {campaign.status}
          </Badge>
          {!isActive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={deleteCampaign}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete campaign"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Show progress view when campaign has runs */}
      {hasRuns && (
        <ProgressView campaign={campaign} onAbort={handleAbort} onRefresh={load} />
      )}

      {/* Draft state: show document management + generate button */}
      {campaign.status === "draft" && (
        <>
          <Separator />

          {/* Documents */}
          <div>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mb-4 flex items-center gap-2">
              <FileText className="h-7 w-7" />
              Documents
            </h2>

            {campaign.documents.length > 0 && (
              <div className="space-y-2 mb-4">
                {campaign.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    {getFileIcon(d.filename)}
                    <span className="text-sm font-medium flex-1">{d.filename}</span>
                    <span className="text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => deleteDocument(d.id)}
                      className="ml-1 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.md,.txt" multiple className="hidden" onChange={handleFileInput} disabled={uploading} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-lg font-semibold">Drop files here or click to browse</p>
                  <p className="text-sm text-muted-foreground">PDF, Markdown, and text files</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Target: {campaign.targetLeads.toLocaleString()} leads
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.documents.length} document{campaign.documents.length !== 1 ? "s" : ""} uploaded
                  </p>
                </div>
                <div className="flex gap-0">
                  <Button onClick={handleGenerate} disabled={generating || campaign.documents.length === 0} size="lg" className="rounded-r-none">
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Start Discovery</>
                    )}
                  </Button>
                  <div className="relative">
                    <Button
                      variant="default"
                      size="lg"
                      className="rounded-l-none border-l border-l-primary-foreground/20 px-3"
                      onClick={() => setProviderMenuOpen(!providerMenuOpen)}
                      disabled={generating}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    {providerMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setProviderMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-popover p-1 shadow-md">
                          {PROVIDERS.map((p) => (
                            <button
                              key={p}
                              onClick={() => changeProvider(p)}
                              className={`w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${
                                p === provider ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground"
                              }`}
                            >
                              {PROVIDER_LABELS[p]}{p === provider && " \u2713"}
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
    </div>
  );
}
