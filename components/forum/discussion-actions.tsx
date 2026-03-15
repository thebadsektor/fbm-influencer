"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";

interface DiscussionActionsProps {
    discussionId: string;
    initialUpvotes: number;
    initialDownvotes: number;
    initialUserVote?: string | null;
    isAuthenticated: boolean;
}

export default function DiscussionActions({
    discussionId,
    initialUpvotes,
    initialDownvotes,
    initialUserVote,
    isAuthenticated
}: DiscussionActionsProps) {
    const [upvotes, setUpvotes] = useState(initialUpvotes);
    const [downvotes, setDownvotes] = useState(initialDownvotes);
    const [userVote, setUserVote] = useState(initialUserVote);
    const [isVoting, setIsVoting] = useState(false);
    const router = useRouter();

    const handleVote = async (type: "UPVOTE" | "DOWNVOTE") => {
        if (!isAuthenticated) {
            toast.error("Please sign in to vote");
            return;
        }

        setIsVoting(true);
        try {
            const res = await axios.post(`/api/discussions/${discussionId}/vote`, { type });
            // The API usually returns the new counts or we refresh
            // If the API returns the counts:
            if (res.data) {
                setUpvotes(res.data.upvotes);
                setDownvotes(res.data.downvotes);
                setUserVote(res.data.userVote);
            }
            router.refresh();
        } catch (error) {
            toast.error("Failed to vote");
        } finally {
            setIsVoting(false);
        }
    };

    const handleReport = async () => {
        if (!isAuthenticated) {
            toast.error("Please sign in to report");
            return;
        }

        const reason = prompt("Reason for reporting this discussion:");
        if (!reason) return;

        try {
            await axios.post(`/api/discussions/${discussionId}/report`, { reason });
            toast.success("Discussion reported. Thank you for keeping our community safe.");
            router.refresh();
        } catch (error) {
            toast.error("Failed to report");
        }
    };

    return (
        <div className="flex items-center justify-between border-t border-b py-4 my-8">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={isVoting}
                            onClick={() => handleVote("UPVOTE")}
                            className={userVote === "UPVOTE" ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" : "text-muted-foreground"}
                        >
                            <ThumbsUp size={18} className="mr-1.5" />
                            <span className="font-bold">{upvotes}</span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={isVoting}
                            onClick={() => handleVote("DOWNVOTE")}
                            className={userVote === "DOWNVOTE" ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-muted-foreground"}
                        >
                            <ThumbsDown size={18} className="mr-1.5" />
                            <span className="font-bold">{downvotes}</span>
                        </Button>
                    </div>
                </div>
            </div>

            <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-red-600"
                onClick={handleReport}
            >
                <Flag size={18} className="mr-2" /> Report
            </Button>
        </div>
    );
}
