"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
    BarChart3, MessageSquare, FileText, Eye,
    Search, Globe, Lock, CheckCircle2, XCircle, Flag,
    AlertCircle, MessageCircle, ArrowRight,
    ChevronLeft, ChevronRight, Plus, Edit2
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { RedirectToSignIn } from "@daveyplate/better-auth-ui";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";

export default function AdminForumPage() {
    const [analytics, setAnalytics] = useState<any>(null);
    const [discussions, setDiscussions] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    // Pagination and Sorting states
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sort, setSort] = useState("latest");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [analyticsRes, discussionsRes] = await Promise.all([
                axios.get("/api/admin/forum/analytics"),
                axios.get(`/api/discussions?search=${activeSearch}&page=${page}&sort=${sort}&filter=${filter}&limit=10`)
            ]);
            setAnalytics(analyticsRes.data);
            setDiscussions(discussionsRes.data.discussions);
            setTotalPages(discussionsRes.data.pages);
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error("Failed to load forum management data");
        } finally {
            setIsLoading(false);
        }
    }, [activeSearch, page, sort, filter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        setActiveSearch(search);
        setPage(1);
    };

    const toggleSeo = async (id: string, currentSeo: boolean) => {
        try {
            await axios.patch(`/api/admin/forum/discussions/${id}/seo`, {
                isSeo: !currentSeo
            });
            setDiscussions(discussions.map(d => d.id === id ? { ...d, isSeo: !currentSeo } : d));
            toast.success(`SEO ${!currentSeo ? "enabled" : "disabled"} for discussion`);
        } catch (error) {
            toast.error("Failed to toggle SEO");
        }
    };

    const toggleLock = async (id: string, currentLocked: boolean) => {
        try {
            const lockReason = !currentLocked ? prompt("Reason for locking:") : null;
            if (!currentLocked && lockReason === null) return;

            await axios.patch(`/api/admin/forum/discussions/${id}/lock`, {
                isLocked: !currentLocked,
                lockReason: lockReason
            });
            setDiscussions(discussions.map(d => d.id === id ? { ...d, isLocked: !currentLocked } : d));
            toast.success(`Discussion ${!currentLocked ? "locked" : "unlocked"}`);
        } catch (error) {
            toast.error("Failed to toggle lock");
        }
    };


    if (isLoading && !analytics) return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading management panel...</div>;

    return (
        <>
            <RedirectToSignIn />
            <div className="p-8 space-y-8 font-sans bg-background min-h-screen">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Forum Management</h1>
                        <p className="text-muted-foreground">Monitor forum activity, track responses, and moderate discussions.</p>
                    </div>
                </div>

                {/* Analytics Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    <AnalyticsCard
                        title="Total Discussions"
                        value={analytics?.totalDiscussions}
                        icon={<FileText className="h-4 w-4" />}
                    />
                    <AnalyticsCard
                        title="Reported"
                        value={analytics?.reportedCount}
                        icon={<Flag className="h-4 w-4 text-red-500" />}
                        highlight={analytics?.reportedCount > 0}
                    />
                    <AnalyticsCard
                        title="From Feedback"
                        value={analytics?.fromFeedbackCount}
                        icon={<Plus className="h-4 w-4 text-amber-500" />}
                    />
                    <AnalyticsCard
                        title="Awaiting Response"
                        value={analytics?.awaitingResponseCount}
                        icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
                        highlight={analytics?.awaitingResponseCount > 0}
                    />
                    <AnalyticsCard
                        title="SEO Enabled"
                        value={analytics?.seoCount}
                        icon={<Globe className="h-4 w-4 text-primary" />}
                    />
                    <AnalyticsCard
                        title="Locked"
                        value={analytics?.lockedCount}
                        icon={<Lock className="h-4 w-4 text-red-600" />}
                    />
                    <AnalyticsCard
                        title="Public"
                        value={analytics?.publicCount}
                        icon={<Globe size={16} />}
                    />
                    <AnalyticsCard
                        title="Private"
                        value={analytics?.privateCount}
                        icon={<Lock size={16} />}
                    />
                    <AnalyticsCard
                        title="Total Comments"
                        value={analytics?.totalComments}
                        icon={<MessageSquare className="h-4 w-4" />}
                    />
                </div>

                {/* Management Table */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            All Discussions
                            <Badge variant="secondary" className="rounded-full">{analytics?.totalDiscussions || (discussions.length > 0 ? "..." : 0)}</Badge>
                        </h2>
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                            <form onSubmit={handleSearch} className="relative flex-1 sm:w-72 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        placeholder="Search by title... (Enter/Button)"
                                        className="pl-10"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" size="sm" variant="secondary" className="h-10">Search</Button>
                            </form>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <select
                                    className="bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-10 w-full sm:w-40"
                                    value={filter}
                                    onChange={(e) => {
                                        setFilter(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="all">All Filters</option>
                                    <option value="awaiting">Awaiting Response</option>
                                    <option value="reported">Reported Only</option>
                                    <option value="feedback">From Feedback</option>
                                    <option value="seo">SEO Enabled</option>
                                    <option value="locked">Locked Only</option>
                                    <option value="public">Public Only</option>
                                    <option value="private">Private Only</option>
                                </select>
                                <select
                                    className="bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-10 w-full sm:w-32"
                                    value={sort}
                                    onChange={(e) => {
                                        setSort(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="latest">Latest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="views">Most Views</option>
                                    <option value="upvotes">Most Voted</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[300px]">Discussion</TableHead>
                                    <TableHead>Response</TableHead>
                                    <TableHead>Author</TableHead>
                                    <TableHead>Engagement</TableHead>
                                    <TableHead>Moderation</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {discussions.map((d) => (
                                    <TableRow key={d.id} className="group hover:bg-muted/20 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Link href={`/forum/${d.id}`} className="hover:text-primary transition-colors font-bold truncate max-w-[200px]">
                                                        {d.title}
                                                    </Link>
                                                    {d.sourceFeedbackId && (
                                                        <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 gap-1 px-1.5 py-0">
                                                            <Plus size={8} /> Feedback
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {d.isPublic ? (
                                                        <Badge variant="outline" className="text-[10px] py-0 h-4 border-muted-foreground/20 text-muted-foreground flex items-center gap-1">
                                                            <Globe size={10} /> Public
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] py-0 h-4 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900 border-yellow-200 flex items-center gap-1">
                                                            <Lock size={10} /> Private
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {d.responseStatus === "awaiting" ? (
                                                <Badge className="bg-amber-500 text-white border-transparent hover:bg-amber-600 shadow-sm whitespace-nowrap">
                                                    Awaiting Response
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400 whitespace-nowrap">
                                                    Replied
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{d.user.name}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{d.user.role}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                                                    <Eye size={12} className="text-muted-foreground" />
                                                    <span>{d.views} views</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                                                    <MessageCircle size={12} className="text-muted-foreground" />
                                                    <span>{d._count.comments} replies</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge
                                                    variant={d._count.reports > 0 ? "destructive" : "outline"}
                                                    className="w-fit text-[10px] px-1.5 h-5"
                                                >
                                                    {d._count.reports} Reports
                                                </Badge>
                                                <div
                                                    className={cn(
                                                        "flex items-center gap-2 text-xs transition-opacity cursor-pointer whitespace-nowrap",
                                                        d.isSeo ? "text-primary opacity-100" : "text-muted-foreground opacity-40 hover:opacity-100"
                                                    )}
                                                    onClick={() => toggleSeo(d.id, d.isSeo)}
                                                >
                                                    {d.isSeo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                    <span>SEO {d.isSeo ? "On" : "Off"}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                                            <div className="text-[10px] opacity-70">{format(new Date(d.createdAt), "MMM d, HH:mm")}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("h-8 w-8", d.isLocked ? "text-amber-500 bg-amber-50" : "text-muted-foreground")}
                                                    onClick={() => toggleLock(d.id, d.isLocked)}
                                                    title={d.isLocked ? "Unlock Discussion" : "Lock Discussion"}
                                                >
                                                    <Lock size={14} />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                                                    <Link href={`/forum/edit/${d.id}`} title="Edit Discussion">
                                                        <Edit2 size={14} />
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" asChild>
                                                    <Link href={`/forum/${d.id}`} title="View Discussion">
                                                        <ArrowRight size={14} />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="gap-1 px-3"
                            >
                                <ChevronLeft size={14} /> Previous
                            </Button>
                            <div className="flex items-center gap-1 mx-4">
                                <span className="text-sm font-medium">Page {page}</span>
                                <span className="text-sm text-muted-foreground">of {totalPages}</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="gap-1 px-3"
                            >
                                Next <ChevronRight size={14} />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function AnalyticsCard({ title, value, icon, highlight = false }: { title: string, value: any, icon: React.ReactNode, highlight?: boolean }) {
    return (
        <div className={cn(
            "p-6 border rounded-xl shadow-sm space-y-2 transition-all",
            highlight ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900" : "bg-card"
        )}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
                <div className="p-2 bg-muted rounded-lg">{icon}</div>
            </div>
            <div className="text-3xl font-extrabold">{value ?? 0}</div>
        </div>
    );
}
