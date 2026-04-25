"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail,
  Send,
  AlertCircle,
  Clock,
  TrendingUp,
  Sparkles,
  DollarSign,
  Users,
  Eye,
} from "lucide-react";

interface FailedRow {
  draftId: string;
  resultId: string;
  creatorHandle: string | null;
  creatorName: string | null;
  platform: string;
  campaignFitScore: number | null;
  sendError: string | null;
  updatedAt: string;
}

interface StaleRow {
  draftId: string;
  resultId: string;
  creatorHandle: string | null;
  creatorName: string | null;
  platform: string;
  campaignFitScore: number | null;
  updatedAt: string;
}

interface Stats {
  eligible: number;
  /** Total Result rows with an email, regardless of fit score. Matches the
   * number the Email Enrichment modal shows. */
  withEmailTotal?: number;
  /** withEmailTotal - eligible: creators with an email but below the fit
   * threshold, intentionally excluded from outreach. */
  belowFit?: number;
  statusCounts: {
    draft: number;
    approved: number;
    sent: number;
    failed: number;
    total: number;
  };
  sendsByDay: { date: string; count: number }[];
  failed: FailedRow[];
  stale: StaleRow[];
  providers: Record<string, number>;
  estimatedCost: number;
  promptIsCustom: boolean;
}

interface Props {
  campaignId: string;
  isGenerating: boolean;
  onOpenLead: (resultId: string) => void;
  onGenerateAll: () => void;
}

export function OutreachDashboard({ campaignId, isGenerating, onOpenLead, onGenerateAll }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/outreach/stats`);
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Poll every 3s while generation is in-flight so counts update live
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, [isGenerating, loadStats]);

  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { eligible, statusCounts, sendsByDay, failed, stale, providers, estimatedCost, promptIsCustom } = stats;
  const draftPct = eligible > 0 ? Math.round((statusCounts.total / eligible) * 100) : 0;
  const sentPct = statusCounts.total > 0 ? Math.round((statusCounts.sent / statusCounts.total) * 100) : 0;
  const maxSends = Math.max(1, ...sendsByDay.map((d) => d.count));
  const attention = [...failed, ...stale.map((s) => ({ ...s, sendError: null }))].slice(0, 10);

  // Stacked bar proportions
  const total = Math.max(1, statusCounts.total);
  const draftProp = (statusCounts.draft / total) * 100;
  const approvedProp = (statusCounts.approved / total) * 100;
  const sentProp = (statusCounts.sent / total) * 100;
  const failedProp = (statusCounts.failed / total) * 100;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* A. Funnel stat cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Outreach-ready"
            value={eligible}
            sub={
              stats.withEmailTotal !== undefined && stats.withEmailTotal !== eligible
                ? `of ${stats.withEmailTotal} with email · ${stats.belowFit ?? stats.withEmailTotal - eligible} below fit threshold`
                : "qualified with email"
            }
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Drafts generated"
            value={statusCounts.total}
            sub={`${draftPct}% of eligible`}
          />
          <StatCard
            icon={<Send className="h-4 w-4" />}
            label="Sent"
            value={statusCounts.sent}
            sub={`${sentPct}% of drafts`}
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Failed"
            value={statusCounts.failed}
            sub={statusCounts.failed > 0 ? "click to view" : "all good"}
            tone={statusCounts.failed > 0 ? "danger" : "default"}
          />
        </div>

        {/* B. Live generation panel */}
        {isGenerating && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Generating drafts…</span>
              <span className="text-muted-foreground font-normal">
                {statusCounts.total} of {eligible} complete
              </span>
            </div>
            <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, (statusCounts.total / Math.max(1, eligible)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Live counts update every few seconds. Keep this tab open.
            </p>
          </div>
        )}

        {/* C. Activity & distribution */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sends over time */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Sends over 14 days
              </h3>
              <span className="text-xs text-muted-foreground">
                {sendsByDay.reduce((s, d) => s + d.count, 0)} total
              </span>
            </div>
            {sendsByDay.every((d) => d.count === 0) ? (
              <div className="h-[92px] flex items-center justify-center text-xs text-muted-foreground">
                No sends yet
              </div>
            ) : (
              <div className="flex items-end gap-1 h-[92px]">
                {sendsByDay.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 group relative flex flex-col items-center"
                    title={`${d.date}: ${d.count}`}
                  >
                    <div
                      className="w-full bg-primary/70 hover:bg-primary rounded-t transition-all"
                      style={{ height: `${(d.count / maxSends) * 80}px`, minHeight: d.count > 0 ? 2 : 0 }}
                    />
                    <span className="text-[9px] text-muted-foreground mt-1">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status breakdown */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Draft status breakdown</h3>
            {statusCounts.total === 0 ? (
              <div className="h-[92px] flex items-center justify-center text-xs text-muted-foreground">
                No drafts yet —{" "}
                <button onClick={onGenerateAll} className="underline ml-1" disabled={isGenerating}>
                  generate some
                </button>
              </div>
            ) : (
              <>
                <div className="h-3 rounded-full overflow-hidden flex bg-muted">
                  {draftProp > 0 && <div className="bg-slate-400" style={{ width: `${draftProp}%` }} />}
                  {approvedProp > 0 && <div className="bg-blue-500" style={{ width: `${approvedProp}%` }} />}
                  {sentProp > 0 && <div className="bg-green-500" style={{ width: `${sentProp}%` }} />}
                  {failedProp > 0 && <div className="bg-red-500" style={{ width: `${failedProp}%` }} />}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-xs">
                  <LegendRow color="bg-slate-400" label="Draft" count={statusCounts.draft} />
                  <LegendRow color="bg-blue-500" label="Approved" count={statusCounts.approved} />
                  <LegendRow color="bg-green-500" label="Sent" count={statusCounts.sent} />
                  <LegendRow color="bg-red-500" label="Failed" count={statusCounts.failed} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* D. Needs attention */}
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Needs attention
            </h3>
            <span className="text-xs text-muted-foreground">
              {failed.length} failed · {stale.length} stale (&gt;7 days)
            </span>
          </div>
          {attention.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nothing to fix. All drafts are fresh and sending cleanly.
            </div>
          ) : (
            <div className="divide-y">
              {attention.map((row) => {
                const isFailed = "sendError" in row && row.sendError !== null;
                return (
                  <div key={row.draftId} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">{row.creatorName || "Unknown"}</span>
                        <span className="text-muted-foreground text-xs">@{row.creatorHandle}</span>
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {row.platform === "TIKTOK" ? "TikTok" : "YouTube"}
                        </Badge>
                        {isFailed ? (
                          <Badge variant="destructive" className="text-[10px] py-0 h-4">Failed</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 h-4 gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Stale
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {isFailed ? row.sendError : `No changes since ${new Date(row.updatedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpenLead(row.resultId)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Open
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* E. Cost & meta */}
        <div className="rounded-lg border bg-muted/20 px-4 py-3 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> LLM spend (est.)
            </div>
            <div className="text-sm font-medium mt-0.5">${estimatedCost.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Providers
            </div>
            <div className="text-sm font-medium mt-0.5 flex gap-2 flex-wrap">
              {Object.keys(providers).length === 0 ? (
                <span className="text-muted-foreground font-normal">—</span>
              ) : (
                Object.entries(providers).map(([p, c]) => (
                  <span key={p}>{p}: {c}</span>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> Prompt
            </div>
            <div className="text-sm font-medium mt-0.5">
              {promptIsCustom ? "Custom" : "Default"}
            </div>
          </div>
        </div>

        {/* Open-tracking hint */}
        <p className="text-center text-xs text-muted-foreground pb-2">
          Open & reply tracking coming soon — requires SendGrid webhook wiring.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "danger" && value > 0 ? "border-red-500/30 bg-red-500/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${tone === "danger" && value > 0 ? "text-red-500" : ""}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function LegendRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium">{count}</span>
    </div>
  );
}
