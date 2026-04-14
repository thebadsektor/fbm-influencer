"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Loader2,
  Send,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  AlertCircle,
  Settings2,
  ExternalLink,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Sun,
  Moon,
} from "lucide-react";

interface Lead {
  id: string;
  creatorName: string | null;
  creatorHandle: string | null;
  platform: string;
  email: string | null;
  followers: string | null;
  campaignFitScore: number | null;
  profileUrl: string | null;
  draft: { id: string; subject: string; status: string; version: number } | null;
}

interface DraftDetail {
  id: string;
  subject: string;
  body: string;
  status: string;
  version: number;
  promptUsed: string | null;
  previousVersions: { version: number; subject: string; body: string; generatedAt: string }[] | null;
  result: {
    creatorName: string | null;
    creatorHandle: string | null;
    email: string | null;
    platform: string;
    campaignFitScore: number | null;
    profileUrl: string | null;
  };
}

export function OutreachModal({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");

  // WYSIWYG state
  const editorRef = useRef<HTMLDivElement>(null);
  const [, forceRender] = useState(0);
  const [canvasTheme, setCanvasTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("email-composer-theme") as "light" | "dark") || "light";
    }
    return "light";
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const perPage = 20;

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/outreach?page=${page}&limit=${perPage}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.results);
      setTotal(data.total);
      setStatusCounts(data.statusCounts);
    }
    setLoading(false);
  }, [campaignId, page]);

  useEffect(() => { if (open) loadLeads(); }, [open, loadLeads]);

  // Convert plain text to HTML if body doesn't contain HTML tags
  const toHtml = (text: string) => {
    if (!text) return "";
    if (/<[a-z][\s\S]*>/i.test(text)) return text; // already HTML
    return text.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  };

  const loadDraft = useCallback(async (draftId: string) => {
    setDraftLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/outreach/${draftId}`);
    if (res.ok) {
      const d = await res.json();
      setDraft(d);
      setEditSubject(d.subject);
      setEditBody(toHtml(d.body));
    }
    setDraftLoading(false);
  }, [campaignId]);

  const selectLead = (lead: Lead) => {
    setSelectedId(lead.id);
    if (lead.draft) {
      loadDraft(lead.draft.id);
    } else {
      setDraft(null);
      setEditSubject("");
      setEditBody("");
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    await fetch(`/api/campaigns/${campaignId}/outreach/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadLeads();
    setGenerating(false);
  };

  const handleGenerateOne = async (resultId: string) => {
    setGenerating(true);
    await fetch(`/api/campaigns/${campaignId}/outreach/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultIds: [resultId] }),
    });
    await loadLeads();
    // Reload draft for the selected lead
    const lead = leads.find((l) => l.id === resultId);
    if (lead) {
      const res = await fetch(`/api/campaigns/${campaignId}/outreach?page=${page}&limit=${perPage}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.results);
        const updatedLead = data.results.find((l: Lead) => l.id === resultId);
        if (updatedLead?.draft) loadDraft(updatedLead.draft.id);
      }
    }
    setGenerating(false);
  };

  const handleRegenerate = async () => {
    if (!draft) return;
    setRegenerating(true);
    const res = await fetch(`/api/campaigns/${campaignId}/outreach/${draft.id}`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setDraft({ ...draft, ...updated });
      setEditSubject(updated.subject);
      setEditBody(toHtml(updated.body));
    }
    await loadLeads();
    setRegenerating(false);
  };

  const handleSave = async (subject?: string, body?: string) => {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    await fetch(`/api/campaigns/${campaignId}/outreach/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject ?? editSubject, body: body ?? editBody }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Debounced auto-save
  const debouncedSave = useCallback((subject: string, body: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(subject, body);
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, campaignId]);

  // WYSIWYG helpers
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    forceRender((n) => n + 1);
    // Trigger auto-save after formatting change
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditBody(html);
      debouncedSave(editSubject, html);
    }
  }, [debouncedSave, editSubject]);

  const isCommandActive = useCallback((command: string) => {
    try { return document.queryCommandState(command); } catch { return false; }
  }, []);

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) execCommand("createLink", url);
  };

  const toggleCanvasTheme = () => {
    setCanvasTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("email-composer-theme", next);
      return next;
    });
  };

  // Set editor content when draft changes
  useEffect(() => {
    if (editorRef.current && editBody && editorRef.current.innerHTML !== editBody) {
      editorRef.current.innerHTML = editBody;
    }
  }, [draft?.id]); // Only on draft change, not on every editBody change

  const handleSend = async (draftIds: string[]) => {
    setSending(true);
    await fetch(`/api/campaigns/${campaignId}/outreach/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftIds }),
    });
    await loadLeads();
    if (draft && draftIds.includes(draft.id)) {
      loadDraft(draft.id);
    }
    setSending(false);
  };

  const loadPrompt = async () => {
    setPromptLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/outreach/prompt`);
    if (res.ok) {
      const data = await res.json();
      setPrompt(data.prompt);
    }
    setPromptLoading(false);
  };

  const savePrompt = async () => {
    await fetch(`/api/campaigns/${campaignId}/outreach/prompt`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  };

  const totalPages = Math.ceil(total / perPage);

  const draftStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary" className="text-xs">Draft</Badge>;
      case "sent": return <Badge variant="default" className="text-xs gap-1"><Check className="h-2.5 w-2.5" />Sent</Badge>;
      case "failed": return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case "approved": return <Badge className="text-xs bg-blue-500">Approved</Badge>;
      default: return <Badge variant="outline" className="text-xs">No Draft</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Outreach
              <span className="text-sm font-normal text-muted-foreground">{total} qualified leads</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowPrompt(!showPrompt); if (!showPrompt && !prompt) loadPrompt(); }}>
                <Settings2 className="h-4 w-4 mr-1" /> Prompt
              </Button>
              <Button variant="outline" size="sm" disabled={generating} onClick={handleGenerateAll}>
                {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {generating ? "Generating..." : "Generate All Drafts"}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
                <span className="text-lg leading-none">&times;</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-muted-foreground mt-2 pb-3">
            {generating && (
              <span className="text-primary animate-pulse">Generating drafts for {total - (statusCounts.total || 0)} leads... this may take a minute</span>
            )}
            {!generating && <span>{statusCounts.draft || 0} drafts</span>}
            {!generating && <span>{statusCounts.sent || 0} sent</span>}
            <span>{total - (statusCounts.total || 0)} without draft</span>
          </div>
        </DialogHeader>

        {/* Prompt editor (collapsible) */}
        {showPrompt && (
          <div className="px-6 pb-3 border-b">
            {promptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <div className="space-y-2">
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="font-mono text-xs h-40" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowPrompt(false)}>Close</Button>
                  <Button size="sm" onClick={savePrompt}>Save Prompt</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Split panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Lead list */}
          <div className="w-[340px] border-r flex flex-col">
            <div className="flex-1 overflow-y-auto divide-y">
              {loading ? (
                <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
              ) : leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    selectedId === lead.id ? "bg-muted/70" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate max-w-[180px]">{lead.creatorName || "Unknown"}</p>
                    {lead.draft ? draftStatusBadge(lead.draft.status) : draftStatusBadge("none")}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{lead.creatorHandle} &middot; {lead.platform === "TIKTOK" ? "TikTok" : "YouTube"}</p>
                  {lead.email && <p className="text-xs text-green-500 truncate mt-0.5">{lead.email}</p>}
                </button>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t text-xs">
                <span className="text-muted-foreground">Page {page}/{totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-7 px-2"><ChevronLeft className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-7 px-2"><ChevronRight className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Draft editor */}
          <div className="flex-1 flex flex-col">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select a lead to view or generate a draft</p>
              </div>
            ) : draftLoading ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : draft ? (
              <>
                {/* Email header */}
                <div className="p-4 border-b space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-10">To:</span>
                    <span className="font-medium">{draft.result.email}</span>
                    <span className="text-muted-foreground">({draft.result.creatorName} @{draft.result.creatorHandle})</span>
                    {draft.result.profileUrl && (
                      <a href={draft.result.profileUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm w-10">Subj:</span>
                    <Input
                      value={editSubject}
                      onChange={(e) => { setEditSubject(e.target.value); debouncedSave(e.target.value, editBody); }}
                      className="h-8 text-sm"
                      placeholder="Subject line..."
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>v{draft.version}</span>
                    {draft.status === "sent" && <Badge variant="default" className="text-xs">Sent</Badge>}
                    {draft.previousVersions && (draft.previousVersions as unknown[]).length > 0 && (
                      <span>{(draft.previousVersions as unknown[]).length} previous version{(draft.previousVersions as unknown[]).length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>

                {/* WYSIWYG Toolbar */}
                <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border/50">
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); execCommand("bold"); }} className={isCommandActive("bold") ? "bg-muted" : ""}>
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); execCommand("italic"); }} className={isCommandActive("italic") ? "bg-muted" : ""}>
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); execCommand("insertUnorderedList"); }}>
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); execCommand("insertOrderedList"); }}>
                    <ListOrdered className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); addLink(); }}>
                    <LinkIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); execCommand("undo"); }}>
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => { e.preventDefault(); execCommand("redo"); }}>
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={toggleCanvasTheme} title={canvasTheme === "light" ? "Dark preview" : "Light preview"}>
                    {canvasTheme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {/* Email body — WYSIWYG contentEditable */}
                <div className={`flex-1 overflow-y-auto transition-colors ${
                  canvasTheme === "light" ? "bg-white" : "bg-background"
                }`}>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className={`prose prose-sm max-w-none min-h-[300px] px-6 py-4 focus:outline-none text-sm leading-relaxed ${
                      canvasTheme === "light"
                        ? "text-gray-900 prose-headings:text-gray-900 prose-p:text-gray-900 prose-a:text-blue-600"
                        : "prose-invert text-foreground"
                    }`}
                    onInput={() => {
                      forceRender((n) => n + 1);
                      if (editorRef.current) {
                        const html = editorRef.current.innerHTML;
                        setEditBody(html);
                        debouncedSave(editSubject, html);
                      }
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="p-4 border-t flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button onClick={() => handleSend([draft.id])} disabled={sending || draft.status === "sent"} size="sm">
                      {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      {draft.status === "sent" ? "Sent" : "Send"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                      {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      Regenerate
                    </Button>
                  </div>
                  {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
                  {saved && !saving && <span className="text-xs text-green-500">Saved</span>}
                </div>
              </>
            ) : (
              /* No draft yet — offer to generate */
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <p className="text-sm text-muted-foreground">No draft for this lead yet</p>
                <Button variant="outline" size="sm" onClick={() => selectedId && handleGenerateOne(selectedId)} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Generate Draft
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
