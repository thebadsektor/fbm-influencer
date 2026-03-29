"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  ExternalLink,
  ChevronDown,
  ChevronUp,
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

interface KHSet {
  id: string;
  keywords: string[];
  hashtags: string[];
  locked: boolean;
  status: string;
  platform: string | null;
  parentSetId: string | null;
  createdAt: string;
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
  const [showAllResults, setShowAllResults] = useState(false);
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
            <div className="text-center py-8">
              {/* Replace src with your animated GIF path: /scouting.gif or similar */}
              <img
                src="/scouting-loading.gif"
                alt="Scouting in progress"
                className="h-32 w-32 mx-auto mb-4 rounded-lg"
                onError={(e) => {
                  // Fallback to spinner if GIF not found
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove("hidden");
                }}
              />
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4 hidden" />
              <p className="text-sm text-muted-foreground">This usually takes 2-5 minutes...</p>
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

      {/* Report */}
      {set.results.length > 0 && (() => {
        const totalScraped = set.results.length;
        const qualified = set.results.filter((r) => r.confidence === "high" || r.confidence === "medium");
        const missingEmail = set.results.filter((r) => !r.email);
        const enriched = set.results.filter((r) => r.emailSource === "enrichment");
        const qualifiedPct = totalScraped > 0 ? Math.round((qualified.length / totalScraped) * 100) : 0;
        const enrichmentRate = missingEmail.length > 0
          ? Math.round((enriched.length / (missingEmail.length + enriched.length)) * 100)
          : 100;

        const top5 = [...set.results]
          .sort((a, b) => (parseInt(b.followers || "0") || 0) - (parseInt(a.followers || "0") || 0))
          .slice(0, 5);

        return (
          <div>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
              Report
            </h2>
            <p className="leading-7 text-muted-foreground mb-6">Summary of n8n workflow results.</p>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Total Scraped</p>
                  </div>
                  <p className="text-2xl font-bold">{totalScraped}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">Qualified</p>
                  </div>
                  <p className="text-2xl font-bold">{qualified.length}</p>
                  <p className="text-xs text-muted-foreground">{qualifiedPct}% of total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MailX className="h-4 w-4 text-orange-500" />
                    <p className="text-sm text-muted-foreground">Missing Email</p>
                  </div>
                  <p className="text-2xl font-bold">{missingEmail.length}</p>
                  <p className="text-xs text-muted-foreground">need enrichment</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MailCheck className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">Enriched</p>
                  </div>
                  <p className="text-2xl font-bold">{enriched.length}</p>
                  <p className="text-xs text-muted-foreground">{enrichmentRate}% success rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Top 5 Influencers */}
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-3">Top 5 Influencers</h3>
            <div className="rounded-lg border overflow-hidden mb-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold w-8">#</TableHead>
                    <TableHead className="font-semibold">Handle</TableHead>
                    <TableHead className="font-semibold">Platform</TableHead>
                    <TableHead className="font-semibold">Relevance</TableHead>
                    <TableHead className="font-semibold text-right">Followers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top5.map((r, i) => (
                    <TableRow key={r.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="text-sm text-muted-foreground font-medium">{i + 1}</TableCell>
                      <TableCell>
                        {r.profileUrl ? (
                          <a
                            href={r.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            {r.creatorHandle || r.creatorName || "profile"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium">{r.creatorHandle || r.creatorName || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.platform}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.confidence ? (
                          <Badge
                            variant={
                              r.confidence === "high"
                                ? "default"
                                : r.confidence === "medium"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {r.confidence}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-right tabular-nums">
                        {r.followers ? parseInt(r.followers).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* All Results (collapsible) */}
            <button
              onClick={() => setShowAllResults(!showAllResults)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              {showAllResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAllResults ? "Hide" : "Show"} all {totalScraped} results
            </button>
            {showAllResults && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Creator</TableHead>
                      <TableHead className="font-semibold">Platform</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold">Confidence</TableHead>
                      <TableHead className="font-semibold text-right">Followers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {set.results.map((r, i) => (
                      <TableRow key={r.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell>
                          <div>
                            <p className="text-sm leading-none font-medium">
                              {r.creatorName || r.creatorHandle}
                            </p>
                            {r.profileUrl && (
                              <a
                                href={r.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                              >
                                {r.creatorHandle || "profile"}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.platform}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                            {r.email || "—"}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.emailSource || "—"}
                        </TableCell>
                        <TableCell>
                          {r.confidence ? (
                            <Badge
                              variant={
                                r.confidence === "high"
                                  ? "default"
                                  : r.confidence === "medium"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {r.confidence}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-right tabular-nums">
                          {r.followers ? parseInt(r.followers).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
