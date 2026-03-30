"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { LLMProvider } from "@/lib/llm";
import { PROVIDER_LABELS } from "@/lib/llm";
import {
  ArrowLeft,
  Upload,
  FileText,
  FileCode,
  File,
  Hash,
  Sparkles,
  Loader2,
  ChevronDown,
  X,
  Trash2,
} from "lucide-react";

const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "gemini"];

interface Campaign {
  id: string;
  name: string;
  status: string;
  marketingGoal: string;
  brandNiche: string;
  targetAudienceAge: string;
  targetLocation: string[];
  audienceInterests: string[];
  minFollowers: string;
  minEngagementRate: number;
  numberOfInfluencers: number;
  targetKeywords: number;
  targetHashtags: number;
  trendingTopics: string | null;
  competitorBrands: string | null;
  additionalKeywords: string | null;
  documents: { id: string; filename: string; createdAt: string }[];
  khSets: {
    id: string;
    status: string;
    locked: boolean;
    keywords: string[];
    hashtags: string[];
    createdAt: string;
  }[];
}

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (filename.endsWith(".md")) return <FileCode className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Provider state — persisted in localStorage
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

  // KH generation controls — initialized from campaign targets after load
  const [minKeywords, setMinKeywords] = useState(5);
  const [maxKeywords, setMaxKeywords] = useState(5);
  const [minHashtags, setMinHashtags] = useState(5);
  const [maxHashtags, setMaxHashtags] = useState(5);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setCampaign(data);
      // Initialize generation controls from campaign targets
      setMinKeywords(data.targetKeywords ?? 5);
      setMaxKeywords(data.targetKeywords ?? 5);
      setMinHashtags(data.targetHashtags ?? 5);
      setMaxHashtags(data.targetHashtags ?? 5);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

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
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file);
    }
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

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/campaigns/${params.id}/kh-sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minKeywords, maxKeywords, minHashtags, maxHashtags, provider }),
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
          <Badge variant={campaign.status === "active" ? "default" : "secondary"} className="text-sm">
            {campaign.status}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteCampaign}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete campaign"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Age</p>
            <p className="text-lg font-semibold">{campaign.targetAudienceAge}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="text-lg font-semibold">{campaign.targetLocation.join(", ")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Min Followers</p>
            <p className="text-lg font-semibold">{campaign.minFollowers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Engagement</p>
            <p className="text-lg font-semibold">{campaign.minEngagementRate}%+</p>
          </CardContent>
        </Card>
      </div>

      {campaign.audienceInterests.length > 0 && (
        <div>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">Interests</h4>
          <div className="flex flex-wrap gap-2">
            {campaign.audienceInterests.map((i) => (
              <Badge key={i} variant="outline">{i}</Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Document Upload */}
      <div>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4 flex items-center gap-2">
          <FileText className="h-7 w-7" />
          Documents
        </h2>
        <p className="leading-7 text-muted-foreground mb-4">
          Upload additional PDF or Markdown files to provide more context for keyword generation.
        </p>

        {/* Uploaded Files List */}
        {campaign.documents.length > 0 && (
          <div className="space-y-2 mb-4">
            {campaign.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
              >
                {getFileIcon(d.filename)}
                <span className="text-sm leading-none font-medium flex-1">{d.filename}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => deleteDocument(d.id)}
                  className="ml-1 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove document"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt"
            multiple
            className="hidden"
            onChange={handleFileInput}
            disabled={uploading}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm leading-none font-medium">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-lg font-semibold">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground">
                Supports PDF, Markdown, and text files
              </p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* KH Generation */}
      <div>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4 flex items-center gap-2">
          <Hash className="h-7 w-7" />
          Keywords & Hashtags
        </h2>
        <p className="leading-7 text-muted-foreground mb-4">
          Generate keywords and hashtags from your campaign data and uploaded documents.
        </p>

        {/* Generation Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generation Settings
            </CardTitle>
            <CardDescription>
              Control how many keywords and hashtags to generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Min Keywords</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={minKeywords}
                  onChange={(e) => setMinKeywords(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Max Keywords</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxKeywords}
                  onChange={(e) => setMaxKeywords(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Min Hashtags</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={minHashtags}
                  onChange={(e) => setMinHashtags(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Max Hashtags</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxHashtags}
                  onChange={(e) => setMaxHashtags(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="flex gap-0">
              <Button onClick={handleGenerate} disabled={generating} className="flex-1 rounded-r-none" size="lg">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating with {PROVIDER_LABELS[provider]}...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate with {PROVIDER_LABELS[provider]}
                  </>
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
          </CardContent>
        </Card>

        {/* Existing KH Sets */}
        {campaign.khSets.length > 0 && (
          <div className="mt-6">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-3">Previous Sets</h3>
            <div className="space-y-2">
              {campaign.khSets.map((set) => (
                <Link
                  key={set.id}
                  href={`/campaigns/${campaign.id}/kh-sets/${set.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all">
                    <div>
                      <p className="text-sm leading-none font-medium">
                        {set.keywords.length} keywords, {set.hashtags.length} hashtags
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(set.createdAt).toLocaleString()}
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
                    >
                      {set.locked ? "🔒 " : ""}
                      {set.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
