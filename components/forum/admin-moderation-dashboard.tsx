"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
    Lock, Unlock, Globe, CheckCircle2, XCircle,
    AlertTriangle, Eye, MessageCircle, BarChart3,
    Edit2, User as UserIcon, Calendar, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AdminModerationDashboardProps {
    discussion: any;
    isAdmin: boolean;
}

export default function AdminModerationDashboard({ discussion: initialDiscussion, isAdmin }: AdminModerationDashboardProps) {
    const [discussion, setDiscussion] = useState(initialDiscussion);
    const [reports, setReports] = useState<any[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [showReports, setShowReports] = useState(false);

    useEffect(() => {
        if (isAdmin && showReports) {
            fetchReports();
        }
    }, [isAdmin, showReports]);

    const fetchReports = async () => {
        setIsLoadingReports(true);
        try {
            const res = await axios.get(`/api/admin/forum/discussions/${discussion.id}/reports`);
            setReports(res.data);
        } catch (error) {
            toast.error("Failed to load reports");
        } finally {
            setIsLoadingReports(false);
        }
    };

    const toggleLock = async () => {
        try {
            const currentLocked = discussion.isLocked;
            const lockReason = !currentLocked ? prompt("Reason for locking:") : null;
            if (!currentLocked && lockReason === null) return;

            const res = await axios.patch(`/api/admin/forum/discussions/${discussion.id}/lock`, {
                isLocked: !currentLocked,
                lockReason
            });
            setDiscussion({ ...discussion, isLocked: !currentLocked, lockReason });
            toast.success(`Discussion ${!currentLocked ? "locked" : "unlocked"}`);
            // Force reload to update UI in other parts
            window.location.reload();
        } catch (error) {
            toast.error("Failed to toggle lock");
        }
    };

    const toggleSeo = async () => {
        try {
            const currentSeo = discussion.isSeo;
            await axios.patch(`/api/admin/forum/discussions/${discussion.id}/seo`, {
                isSeo: !currentSeo
            });
            setDiscussion({ ...discussion, isSeo: !currentSeo });
            toast.success(`SEO ${!currentSeo ? "enabled" : "disabled"} for discussion`);
        } catch (error) {
            toast.error("Failed to togggle SEO");
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="bg-muted/30 border-2 border-primary/20 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-xl font-extrabold flex items-center gap-2">
                        <AlertTriangle className="text-primary h-5 w-5" />
                        Admin Moderation
                    </h2>
                    <p className="text-sm text-muted-foreground">Manage this discussion's visibility and status.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={discussion.isLocked ? "destructive" : "outline"}
                        size="sm"
                        onClick={toggleLock}
                        className="gap-2"
                    >
                        {discussion.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                        {discussion.isLocked ? "Unlock Thread" : "Lock Thread"}
                    </Button>
                    <Button
                        variant={discussion.isSeo ? "default" : "outline"}
                        size="sm"
                        onClick={toggleSeo}
                        className="gap-2"
                    >
                        {discussion.isSeo ? <CheckCircle2 size={14} /> : <Globe size={14} />}
                        {discussion.isSeo ? "Remove from SEO" : "List for SEO"}
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-2">
                        <a href={`/forum/edit/${discussion.id}`}>
                            <Edit2 size={14} /> Edit Content
                        </a>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <MetricCard
                    label="Views"
                    value={discussion.views}
                    icon={<Eye size={12} />}
                />
                <MetricCard
                    label="Replies"
                    value={discussion._count.comments}
                    icon={<MessageCircle size={12} />}
                />
                <MetricCard
                    label="Upvotes"
                    value={discussion.votes.filter((v: any) => v.type === "UPVOTE").length}
                    icon={<ArrowUpRight size={12} />}
                />
                <MetricCard
                    label="Reports"
                    value={discussion._count.reports}
                    icon={<AlertTriangle size={12} />}
                    isDestructive={discussion._count.reports > 0}
                />
            </div>

            {discussion._count.reports > 0 && (
                <div className="mt-8 pt-6 border-t border-primary/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold flex items-center gap-2">
                            User Reports
                            <Badge variant="destructive" className="rounded-full h-5 text-[10px] px-1.5">{discussion._count.reports}</Badge>
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowReports(!showReports)}
                            className="text-xs text-primary"
                        >
                            {showReports ? "Hide Details" : "View Details"}
                        </Button>
                    </div>

                    {showReports && (
                        <div className="space-y-3">
                            {isLoadingReports ? (
                                <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">Loading report details...</div>
                            ) : reports.length > 0 ? (
                                reports.map((report) => (
                                    <div key={report.id} className="bg-background/50 border rounded-lg p-3 text-sm space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <UserIcon size={12} className="text-muted-foreground" />
                                                <span className="font-medium">{report.user.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <Calendar size={10} />
                                                <span>Reported recently</span>
                                            </div>
                                        </div>
                                        <p className="text-muted-foreground italic bg-muted/50 p-2 rounded border-l-2 border-destructive">"{report.reason}"</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-4 text-xs text-muted-foreground italic">No detailed reports found.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, value, icon, isDestructive = false }: { label: string, value: number, icon: React.ReactNode, isDestructive?: boolean }) {
    return (
        <div className={cn(
            "p-3 border rounded-xl space-y-1 bg-background/40",
            isDestructive && value > 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/5"
        )}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {icon}
                {label}
            </div>
            <div className={cn("text-xl font-black", isDestructive && value > 0 ? "text-destructive" : "text-foreground")}>
                {value}
            </div>
        </div>
    );
}
