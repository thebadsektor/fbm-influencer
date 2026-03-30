"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MARKETING_GOALS, AGE_RANGES, LOCATIONS, INTERESTS, FOLLOWER_TIERS } from "@/lib/constants-influencer";
import type { LLMProvider } from "@/lib/llm";
import { PROVIDER_LABELS } from "@/lib/llm";
import {
  ArrowLeft,
  Upload,
  FileText,
  FileCode,
  File,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

type AnalysisStatus = "idle" | "analyzing" | "success" | "error";

const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "gemini"];

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (filename.endsWith(".md")) return <FileCode className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function StatusMessage({ status, error }: { status: AnalysisStatus; error: string | null }) {
  switch (status) {
    case "analyzing":
      return (
        <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
          <Sparkles className="h-4 w-4" />
          AI is analyzing your document and filling in fields...
        </div>
      );
    case "success":
      return (
        <div className="flex items-center gap-2 text-sm text-green-500">
          <Check className="h-4 w-4" />
          All fields auto-filled from document. Review and edit as needed.
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error || "Something went wrong. You can fill fields manually or try again."}
        </div>
      );
    default:
      return null;
  }
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);

  // Provider state — persisted in localStorage
  const [provider, setProvider] = useState<LLMProvider>("openai");
  useEffect(() => {
    const saved = localStorage.getItem("llm-provider") as LLMProvider | null;
    if (saved && PROVIDERS.includes(saved)) setProvider(saved);
  }, []);
  const changeProvider = (p: LLMProvider) => {
    setProvider(p);
    localStorage.setItem("llm-provider", p);
    setProviderMenuOpen(false);
  };

  // Document state
  const [docFilename, setDocFilename] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    marketingGoal: "Conversions",
    brandNiche: "",
    targetAudienceAge: "25-34 (Millennials)",
    targetLocation: ["US"] as string[],
    audienceInterests: [] as string[],
    minFollowers: "50K",
    minEngagementRate: 3,
    numberOfInfluencers: 25,
    targetKeywords: 50,
    targetHashtags: 30,
    trendingTopics: "",
    additionalKeywords: "",
  });

  const toggleArray = (field: "targetLocation" | "audienceInterests", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  // File selection only — no auto-trigger
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setDocFilename(file.name);
    setStatus("idle");
    setErrorMsg(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // Manual analyze trigger
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setErrorMsg(null);
    setStatus("analyzing");

    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("provider", provider);

    try {
      const res = await fetch("/api/analyze-document", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || `Server error (${res.status})`);
        return;
      }

      const a = data.analysis;

      // Store document for campaign creation
      setDocContent(data.documentContent);
      setDocMimeType(data.documentMimeType);

      // Auto-fill form — preserve user's campaign name if already typed
      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : a.campaignName || "",
        marketingGoal: a.marketingGoal || prev.marketingGoal,
        brandNiche: a.brandNiche || prev.brandNiche,
        targetAudienceAge: a.targetAudienceAge || prev.targetAudienceAge,
        targetLocation: a.targetLocation?.length ? a.targetLocation : prev.targetLocation,
        audienceInterests: a.audienceInterests?.length ? a.audienceInterests : prev.audienceInterests,
        minFollowers: a.minFollowers || prev.minFollowers,
        minEngagementRate: a.minEngagementRate ?? prev.minEngagementRate,
        numberOfInfluencers: a.numberOfInfluencers ?? prev.numberOfInfluencers,
        trendingTopics: a.trendingTopics || prev.trendingTopics,
        additionalKeywords: a.additionalKeywords || prev.additionalKeywords,
      }));

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error. Check your connection and try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        documentContent: docContent,
        documentFilename: docFilename,
        documentMimeType: docMimeType,
        provider,
      }),
    });
    if (res.ok) {
      const campaign = await res.json();
      if (campaign.autoGeneratedKhSetId) {
        router.push(`/campaigns/${campaign.id}/kh-sets/${campaign.autoGeneratedKhSetId}`);
      } else {
        router.push(`/campaigns/${campaign.id}`);
      }
    } else {
      const data = await res.json().catch(() => null);
      setStatus("error");
      setErrorMsg(data?.error || "Failed to create campaign. Please try again.");
    }
    setLoading(false);
  };

  const isAnalyzing = status === "analyzing";

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight mb-2">New Campaign</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Upload a document, then click Analyze to auto-fill your campaign details.
      </p>

      {/* Step 1: Document Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="scroll-m-20 text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
            Upload Your Document
          </CardTitle>
          <CardDescription>
            Upload a PDF, Markdown, or text file. Then click &quot;Analyze&quot; to have AI pre-fill all fields below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              isAnalyzing
                ? "border-primary/50 bg-primary/5 cursor-wait"
                : dragOver
                ? "border-primary bg-primary/5 cursor-pointer"
                : docFilename && status !== "error"
                ? "border-green-500/50 bg-green-500/5 cursor-pointer"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.txt"
              className="hidden"
              onChange={handleFileInput}
              disabled={isAnalyzing}
            />

            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-semibold">Analyzing with {PROVIDER_LABELS[provider]}...</p>
                <p className="text-sm text-muted-foreground">This may take 10-20 seconds</p>
              </div>
            ) : docFilename ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  {getFileIcon(docFilename)}
                  <p className="text-lg font-semibold">{docFilename}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {status === "success" ? "Drop another file to replace." : "Ready for analysis. Drop another file to replace."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-lg font-semibold">Drop your document here or click to browse</p>
                <p className="text-sm text-muted-foreground">PDF, Markdown, or text files</p>
              </div>
            )}
          </div>

          {/* Analyze split button — only shown when file is selected */}
          {selectedFile && !isAnalyzing && (
            <div className="flex gap-0">
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 rounded-r-none"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze with {PROVIDER_LABELS[provider]}
              </Button>
              <div className="relative">
                <Button
                  variant="default"
                  className="rounded-l-none border-l border-l-primary-foreground/20 px-2"
                  onClick={() => setProviderMenuOpen(!providerMenuOpen)}
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
                            p === provider
                              ? "bg-accent text-accent-foreground font-medium"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          {PROVIDER_LABELS[p]}
                          {p === provider && " ✓"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Status line */}
          <div className="min-h-[24px]">
            <StatusMessage status={status} error={errorMsg} />
          </div>
        </CardContent>
      </Card>

      {status === "success" && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Fields below were auto-filled by AI. <span className="text-foreground font-medium">All fields are editable</span> — adjust anything before creating.
          </p>
        </div>
      )}

      {/* Step 2: Campaign Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="scroll-m-20 text-2xl font-semibold tracking-tight flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              Campaign Details
            </CardTitle>
            <CardDescription>Review and edit the campaign parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Q1 TikTok Push"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Brand / Niche</Label>
              <Input
                value={form.brandNiche}
                onChange={(e) => setForm({ ...form, brandNiche: e.target.value })}
                placeholder="e.g., Eco-friendly skincare"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Marketing Goal</Label>
              <Select
                value={form.marketingGoal}
                onValueChange={(v) => v && setForm({ ...form, marketingGoal: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETING_GOALS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Keywords</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={form.targetKeywords}
                    onChange={(e) => setForm({ ...form, targetKeywords: Number(e.target.value) })}
                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.targetKeywords}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, targetKeywords: v === "" ? 1 : Math.min(50, Math.max(1, parseInt(v) || 1)) });
                    }}
                    className="w-16 text-center"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Hashtags</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={form.targetHashtags}
                    onChange={(e) => setForm({ ...form, targetHashtags: Number(e.target.value) })}
                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.targetHashtags}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, targetHashtags: v === "" ? 1 : Math.min(30, Math.max(1, parseInt(v) || 1)) });
                    }}
                    className="w-16 text-center"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Audience Age</Label>
              <Select
                value={form.targetAudienceAge}
                onValueChange={(v) => v && setForm({ ...form, targetAudienceAge: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Location</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggleArray("targetLocation", loc)}
                    className={`px-3 py-1.5 rounded-full text-sm leading-none font-medium border transition-all ${
                      form.targetLocation.includes(loc)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Audience Interests</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleArray("audienceInterests", interest)}
                    className={`px-3 py-1.5 rounded-full text-sm leading-none font-medium border transition-all ${
                      form.audienceInterests.includes(interest)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              {form.audienceInterests.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {form.audienceInterests.length} selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Min Followers</Label>
              <Select
                value={form.minFollowers}
                onValueChange={(v) => v && setForm({ ...form, minFollowers: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWER_TIERS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Engagement Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.minEngagementRate}
                  onChange={(e) =>
                    setForm({ ...form, minEngagementRate: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Influencers</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.numberOfInfluencers}
                  onChange={(e) =>
                    setForm({ ...form, numberOfInfluencers: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => router.push("/")}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || isAnalyzing} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {docContent ? "Creating & generating keywords..." : "Creating..."}
              </>
            ) : (
              "Create Campaign"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
