import Link from "next/link";
import { MessageSquare, Eye, Lock, Globe, User, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface DiscussionCardProps {
    discussion: {
        id: string;
        title: string;
        isPublic: boolean;
        sourceFeedbackId?: string | null;
        views: number;
        createdAt: Date | string;
        user: {
            name: string;
            image?: string | null;
        };
        _count: {
            comments: number;
        };
        votes: { type: string }[];
    };
}

export default function DiscussionCard({ discussion }: DiscussionCardProps) {
    const upvotes = discussion.votes?.filter(v => v.type === "UPVOTE").length || 0;
    const downvotes = discussion.votes?.filter(v => v.type === "DOWNVOTE").length || 0;

    return (
        <div className="group border rounded-lg p-4 hover:border-primary/50 transition-colors bg-card">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        {discussion.isPublic ? (
                            <Globe size={14} className="text-muted-foreground" />
                        ) : (
                            <Lock size={14} className="text-yellow-600" />
                        )}
                        <Link
                            href={`/forum/${discussion.id}`}
                            className="text-lg font-semibold group-hover:text-primary transition-colors"
                        >
                            {discussion.title}
                        </Link>
                        {discussion.sourceFeedbackId && (
                            <Badge variant="outline" className="text-[8px] h-4 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 gap-1 px-1.5 py-0">
                                <Plus size={8} />
                                Feedback
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                            {discussion.user.image ? (
                                <img
                                    src={discussion.user.image}
                                    alt={discussion.user.name}
                                    className="w-4 h-4 rounded-full"
                                />
                            ) : (
                                <User size={14} />
                            )}
                            <span>{discussion.user.name}</span>
                        </div>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center min-w-[40px]">
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Eye size={16} />
                            <span>{discussion.views}</span>
                        </div>
                        <span className="text-[10px] uppercase text-muted-foreground">Views</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[40px]">
                        <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                            <span className="text-xs">▲</span>
                            <span>{upvotes}</span>
                        </div>
                        <span className="text-[8px] uppercase text-muted-foreground">Up</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[40px]">
                        <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                            <span className="text-xs">▼</span>
                            <span>{downvotes}</span>
                        </div>
                        <span className="text-[8px] uppercase text-muted-foreground">Down</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[40px]">
                        <div className="flex items-center gap-1 text-primary text-sm font-medium">
                            <MessageSquare size={16} />
                            <span>{discussion._count.comments}</span>
                        </div>
                        <span className="text-[10px] uppercase text-muted-foreground">Replies</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
