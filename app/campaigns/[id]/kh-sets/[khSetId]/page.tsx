"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import EmailDistribution from "@/components/email-distribution";
import {
  ArrowLeft,
  Rocket,
  Sparkles,
  Loader2,
  X,
  Plus,
  ExternalLink,
  Users,
  UserCheck,
  MailX,
  MailCheck,
  RotateCcw,
  CircleStop,
  Youtube,
  Music2,
  Layers,
  FlaskConical,
} from "lucide-react";

/* ── Configurable scouting pipeline steps ──
 *  To add a new step:
 *    - For a top-level DB column: { label, field, denominatorField? }
 *    - For an extraStats key:     { label, field, denominatorField?, isExtra: true }
 *  n8n pushes extraStats keys via POST /api/webhooks/n8n-stats-sync
 */
type SubStat = { label: string; field?: string; isExtra?: boolean; compute?: (s: KHSet) => number };
type ScoutingStep = {
  label: string;
  field: string | null;
  denominatorField?: string;
  isExtra?: boolean;
  subStats?: SubStat[];
};

const SCOUTING_STEPS: ScoutingStep[] = [
  { label: "Scrape Lead Pool", field: "totalScraped" },
  {
    label: "Filter by Relevance",
    field: "qualified",
    subStats: [
      { label: "Pool", compute: (s) => Math.max(0, (s.totalScraped || 0) - (s.qualified || 0) - (s.disqualified || 0)) },
      { label: "Relevant", field: "qualified" },
      { label: "Irrelevant", field: "disqualified" },
    ],
  },
  { label: "Scrape Email", field: "missingEmail", denominatorField: "qualified" },
  { label: "Deeper Email Enrichment 1", field: "enriched", denominatorField: "qualified" },
  { label: "Deeper Email Enrichment 2", field: "enriched2", denominatorField: "qualified", isExtra: true },
];

interface KHSet {
  id: string;
  keywords: string[];
  hashtags: string[];
  locked: boolean;
  status: string;
  platform: string | null;
  parentSetId: string | null;
  createdAt: string;
  totalScraped: number;
  qualified: number;
  disqualified: number;
  missingEmail: number;
  enriched: number;
  leadPoolUrl: string | null;
  extraStats: Record<string, number>;
  lastSyncedAt: string | null;
  results: {
    id: string;
    platform: string;
    creatorName: string | null;
    creatorHandle: string | null;
    profileUrl: string | null;
    email: string | null;
    emailSource: string | null;
    confidence: string | null;
    followers: string | null;
    engagementRate: string | null;
  }[];
}

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

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/campaigns/${params.id}/kh-sets/${params.khSetId}`
    );
    if (res.ok) setSet(await res.json());
  }, [params.id, params.khSetId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!set || set.status !== "processing") return;
    const interval = setInterval(load, 5000);
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
    await fetch(
      `/api/campaigns/${params.id}/kh-sets/${params.khSetId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, testMode }),
      }
    );
    await load();
    setSubmitting(false);
  };

  const handleReset = async () => {
    await fetch(
      `/api/campaigns/${params.id}/kh-sets/${params.khSetId}/reset`,
      { method: "POST" }
    );
    await load();
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    const res = await fetch(
      `/api/campaigns/${params.id}/kh-sets/${params.khSetId}/optimize`,
      { method: "POST" }
    );
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
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">Campaign Keywords and Hashtags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {new Date(set.createdAt).toLocaleString()}
            {set.parentSetId && " · Optimized from previous set"}
          </p>
        </div>
        <Badge
          variant={
            set.status === "completed"
              ? "default"
              : set.status === "failed"
              ? "destructive"
              : "secondary"
          }
          className="text-sm px-3 py-1"
        >
          {set.status}
        </Badge>
      </div>

      {/* Keywords */}
      <div>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
          Keywords
          <span className="text-lg font-normal text-muted-foreground ml-2">({set.keywords.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {set.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm leading-none font-medium"
            >
              {kw}
              {isEditable && (
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Add keyword..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
            />
            <Button variant="outline" onClick={addKeyword} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Hashtags */}
      <div>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
          Hashtags
          <span className="text-lg font-normal text-muted-foreground ml-2">({set.hashtags.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {set.hashtags.map((ht) => (
            <span
              key={ht}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm leading-none font-medium"
            >
              {ht}
              {isEditable && (
                <button
                  onClick={() => removeHashtag(ht)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <Input
              value={newHashtag}
              onChange={(e) => setNewHashtag(e.target.value)}
              placeholder="Add hashtag..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
            />
            <Button variant="outline" onClick={addHashtag} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Run Discovery */}
      <Card>
        <CardHeader>
          <CardTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">
            {set.status === "processing" ? "Scouting in Progress" : set.status === "completed" ? "Scouts Are Back!" : "Run Discovery"}
          </CardTitle>
          <CardDescription>
            {set.status === "draft" && "Pick your platform and send the scouts out."}
            {set.status === "processing" && "Our scouts are out in the wild hunting for creators..."}
            {set.status === "completed" && "Your creators are lined up and ready to go."}
            {set.status === "failed" && "Pick your platform and send the scouts out."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {set.status === "draft" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant={platform === "youtube" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlatform("youtube")}
                  >
                    <Youtube className="h-4 w-4 mr-1.5" />
                    YouTube
                  </Button>
                  <Button
                    variant={platform === "tiktok" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlatform("tiktok")}
                  >
                    <Music2 className="h-4 w-4 mr-1.5" />
                    TikTok
                  </Button>
                  <Button
                    variant={platform === "both" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlatform("both")}
                  >
                    <Layers className="h-4 w-4 mr-1.5" />
                    All
                  </Button>
                </div>
                <Button
                  variant={testMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTestMode(!testMode)}
                  className={testMode ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                >
                  <FlaskConical className="h-4 w-4 mr-1.5" />
                  Test
                </Button>
              </div>
              <Button onClick={handleRunDiscovery} disabled={submitting} className="w-full" size="lg">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Run Discovery
                  </>
                )}
              </Button>
            </div>
          )}

          {set.status === "processing" && (
            <div className="flex items-center justify-center gap-8 py-6">
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
                <p className="text-xs text-muted-foreground mt-2">See the report below for updates.</p>
              </div>

              {/* Right — scrollable step list */}
              <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                {SCOUTING_STEPS.map((step) => {
                  const resolve = (key: string | undefined, extra?: boolean): number | null => {
                    if (!key) return null;
                    if (extra) return (set.extraStats as Record<string, number>)?.[key] ?? null;
                    return (set as unknown as Record<string, unknown>)[key] as number ?? null;
                  };
                  const value = step.field ? resolve(step.field, step.isExtra) : null;
                  const denom = step.denominatorField ? resolve(step.denominatorField) : null;

                  // subStats: 3-part display like "Pool (45) | Relevant (3) | Irrelevant (2)"
                  if (step.subStats) {
                    const subValues = step.subStats.map((s) =>
                      s.compute ? s.compute(set) : (resolve(s.field, s.isExtra) ?? 0)
                    );
                    const anyPopulated = subValues.some((v) => v > 0);

                    return (
                      <div key={step.label} className="flex items-center justify-end gap-3">
                        <span className="text-sm font-semibold text-right">{step.label}</span>
                        {anyPopulated ? (
                          <span className="text-sm tabular-nums flex items-center gap-1.5">
                            {step.subStats.map((s, i) => (
                              <span key={s.label} className="flex items-center gap-1.5">
                                {i > 0 && <span className="text-muted-foreground">|</span>}
                                <span className="text-muted-foreground">{s.label}</span>
                                <span className="font-bold text-green-500">({subValues[i]})</span>
                              </span>
                            ))}
                          </span>
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    );
                  }

                  const hasValue = value !== null && value > 0;

                  return (
                    <div key={step.label} className="flex items-center justify-end gap-3">
                      <span className="text-sm font-semibold text-right">{step.label}</span>
                      {hasValue ? (
                        <>
                          <span className="text-sm font-bold text-green-500 tabular-nums">
                            ({denom && denom > 0 ? `${value}/${denom}` : value})
                          </span>
                          {step.field === "totalScraped" && (
                            <a
                              href={set.leadPoolUrl || "https://docs.google.com/spreadsheets/d/1PCYrf6sfYWeAee9MtpoIlQf9IiRU008yME7039aBNkc/edit?gid=0#gid=0"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open Lead Pool
                              </Button>
                            </a>
                          )}
                        </>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {set.status === "completed" && (
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{set.results.length} results found</p>
              <Button onClick={handleOptimize} disabled={optimizing} variant="outline" size="lg">
                {optimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Optimize KH Set
                  </>
                )}
              </Button>
            </div>
          )}

          {set.status === "failed" && (
            <div className="text-center py-4 space-y-3">
              <div>
                <p className="text-lg font-semibold text-destructive">Oops, Something Went Wrong</p>
                <p className="text-sm text-muted-foreground">
                  Hmm, our scouts couldn&apos;t reach base camp. Give it another shot!
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRunDiscovery} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry
                  </>
                )}
              </Button>
              <div>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <CircleStop className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report — visible during processing and completed */}
      {(set.status === "processing" || set.status === "completed") && (
        <div>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
            Report
          </h2>
          <p className="leading-7 text-muted-foreground mb-6">
            {set.lastSyncedAt
              ? `Last synced ${new Date(set.lastSyncedAt).toLocaleString()}`
              : "Pending sync from n8n"}
          </p>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Total Scraped</p>
                </div>
                <p className="text-2xl font-bold">{set.totalScraped || "—"}</p>
                <p className="text-xs text-muted-foreground">Saved in Lead Pool</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-muted-foreground">Qualified</p>
                </div>
                <p className="text-2xl font-bold">{set.qualified || "—"}</p>
                <p className="text-xs text-muted-foreground">Recorded in CRM</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <MailX className="h-4 w-4 text-orange-500" />
                  <p className="text-sm text-muted-foreground">Missing Email</p>
                </div>
                <p className="text-2xl font-bold">{set.missingEmail || "—"}</p>
                <p className="text-xs text-muted-foreground">Awaiting enrichment</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <MailCheck className="h-4 w-4 text-blue-500" />
                  <p className="text-sm text-muted-foreground">Enriched</p>
                </div>
                <p className="text-2xl font-bold">{set.enriched || "—"}</p>
                <p className="text-xs text-muted-foreground">Updated periodically</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Email Distribution — visible during processing and completed */}
      {(set.status === "processing" || set.status === "completed") && (
        <EmailDistribution khSetId={set.id} />
      )}
    </div>
  );
}
