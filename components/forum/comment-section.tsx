"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { User, Trash, Star, MessageCircle, Lock } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import MarkdownRenderer from "./markdown-renderer";
import MarkdownEditor from "./markdown-editor";

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    isHighlighted: boolean;
    userId: string;
    user: {
        name: string;
        image?: string | null;
        role?: string | null;
    };
    parentComment?: {
        id: string;
        content: string;
        user: { name: string };
    } | null;
    votes: {
        type: string;
        userId: string;
    }[];
}

interface CommentSectionProps {
    discussionId: string;
    initialComments: Comment[];
    isAuthenticated: boolean;
    currentUserId?: string;
    userRole?: string;
    isLocked?: boolean;
}

export default function CommentSection({
    discussionId,
    initialComments,
    isAuthenticated,
    currentUserId,
    userRole,
    isLocked = false
}: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

    const isAdmin = userRole === "admin" || userRole === "super-admin";

    const scrollToComment = (id: string) => {
        const element = document.getElementById(`comment-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("ring-2", "ring-primary", "ring-offset-2");
            setTimeout(() => {
                element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
            }, 2000);
        }
    };

    const handleVote = async (commentId: string, type: "UPVOTE" | "DOWNVOTE") => {
        if (!isAuthenticated) {
            toast.error("Please sign in to vote");
            return;
        }

        try {
            await axios.post(`/api/discussions/${discussionId}/comments/${commentId}/vote`, { type });
            // Refresh comments or update local state
            const response = await axios.get(`/api/discussions/${discussionId}`);
            setComments(response.data.comments);
        } catch (error) {
            toast.error("Failed to vote");
        }
    };

    const handleHighlight = async (commentId: string) => {
        try {
            const response = await axios.post(`/api/discussions/${discussionId}/comments/${commentId}/highlight`);
            setComments(comments.map(c => c.id === commentId ? { ...c, isHighlighted: response.data.isHighlighted } : c));
            toast.success(response.data.isHighlighted ? "Comment highlighted" : "Comment unhighlighted");
        } catch (error) {
            toast.error("Failed to highlight comment");
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Are you sure you want to delete this comment?")) return;

        try {
            await axios.delete(`/api/discussions/${discussionId}/comments/${commentId}`);
            setComments(comments.filter(c => c.id !== commentId));
            toast.success("Comment deleted");
        } catch (error) {
            toast.error("Failed to delete comment");
        }
    };

    const handleEdit = async (commentId: string) => {
        if (!editValue.trim()) return;

        try {
            const response = await axios.patch(`/api/discussions/${discussionId}/comments/${commentId}`, {
                content: editValue
            });
            setComments(comments.map(c => c.id === commentId ? response.data : c));
            setEditingCommentId(null);
            toast.success("Comment updated");
        } catch (error) {
            toast.error("Failed to update comment");
        }
    };

    const handleSubmit = async () => {
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await axios.post(`/api/discussions/${discussionId}/comments`, {
                content: newComment,
                parentCommentId: replyingTo?.id
            });
            setComments([...comments, response.data]);
            setNewComment("");
            setReplyingTo(null);
            toast.success("Comment added!");
        } catch (error) {
            console.error("Comment error:", error);
            toast.error("Failed to add comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 mt-12 border-t pt-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                Replies <span className="text-muted-foreground text-sm font-normal">({comments.length})</span>
            </h3>

            <div className="space-y-6">
                {comments.length === 0 ? (
                    <p className="text-muted-foreground italic">No replies yet. Be the first to join the conversation!</p>
                ) : (
                    comments
                        .sort((a, b) => (b.isHighlighted ? 1 : 0) - (a.isHighlighted ? 1 : 0))
                        .map((comment) => (
                            <div
                                key={comment.id}
                                className={cn(
                                    "flex gap-4 p-4 rounded-xl transition-all",
                                    comment.isHighlighted
                                        ? "bg-amber-500/5 border border-amber-500/20 shadow-sm dark:bg-amber-500/10"
                                        : "hover:bg-muted/30"
                                )}
                                id={`comment-${comment.id}`}
                            >
                                <div className="flex-shrink-0">
                                    {comment.user.image ? (
                                        <img
                                            src={comment.user.image}
                                            alt={comment.user.name}
                                            className="w-10 h-10 rounded-full"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                            <User size={20} className="text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{comment.user.name}</span>
                                        {comment.user.role && comment.user.role !== "user" && (
                                            <Badge variant="outline" className="text-[10px] py-0 h-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase">
                                                {comment.user.role}
                                            </Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                        </span>
                                        {!isLocked && isAuthenticated && (
                                            <button
                                                onClick={() => {
                                                    setReplyingTo(comment);
                                                    document.getElementById('reply-form')?.scrollIntoView({ behavior: 'smooth' });
                                                }}
                                                className="text-xs text-muted-foreground hover:text-primary ml-2 flex items-center gap-1"
                                            >
                                                <MessageCircle size={12} /> Reply
                                            </button>
                                        )}
                                        {currentUserId === comment.userId && (
                                            <button
                                                onClick={() => {
                                                    setEditingCommentId(comment.id);
                                                    setEditValue(comment.content);
                                                }}
                                                className="text-xs text-primary hover:underline ml-2"
                                            >
                                                Edit
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleHighlight(comment.id)}
                                                className={cn(
                                                    "text-xs hover:underline ml-2 flex items-center gap-1",
                                                    comment.isHighlighted ? "text-amber-500 font-bold" : "text-muted-foreground"
                                                )}
                                            >
                                                <Star size={14} fill={comment.isHighlighted ? "currentColor" : "none"} />
                                                {comment.isHighlighted ? "Highlighted" : "Highlight"}
                                            </button>
                                        )}
                                        {isAdmin && ( // Added delete button for admin
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="text-xs text-red-500 hover:underline ml-2 flex items-center gap-1"
                                            >
                                                <Trash size={14} /> Delete
                                            </button>
                                        )}
                                    </div>
                                    {comment.isHighlighted && (
                                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit">
                                            <Star size={10} fill="currentColor" />
                                            Pinned Response
                                        </div>
                                    )}
                                    {comment.parentComment && (
                                        <div
                                            onClick={() => scrollToComment(comment.parentComment!.id)}
                                            className="bg-muted/50 border-l-4 border-primary/30 p-2 text-xs rounded-r-md cursor-pointer hover:bg-muted transition-colors mb-2"
                                        >
                                            <div className="font-bold text-primary/70 mb-1 flex items-center gap-1">
                                                <MessageCircle size={10} /> {comment.parentComment.user.name} said:
                                            </div>
                                            <div className="line-clamp-2 text-muted-foreground italic">
                                                "{comment.parentComment.content.substring(0, 100)}..."
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        {editingCommentId === comment.id ? (
                                            <div className="space-y-4">
                                                <MarkdownEditor value={editValue} onChange={setEditValue} />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingCommentId(null)} className="text-xs px-3 py-1 border rounded">Cancel</button>
                                                    <button onClick={() => handleEdit(comment.id)} className="text-xs px-3 py-1 bg-primary text-white rounded">Save</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <MarkdownRenderer content={comment.content} />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center gap-3"> {/* Changed gap to 3 */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleVote(comment.id, "UPVOTE")}
                                                    className={`p-1 rounded hover:bg-muted ${comment.votes?.some(v => v.userId === currentUserId && v.type === "UPVOTE") ? "text-primary" : ""}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,122.34l-80-80a8,8,0,0,0-11.32,0l-80,80a8,8,0,0,0,11.32,11.32L120,67.31V208a8,8,0,0,0,16,0V67.31l66.34,66.35a8,8,0,0,0,11.32-11.32Z"></path></svg>
                                                </button>
                                                <span className="text-xs font-medium text-emerald-600"> {/* Added text-emerald-600 */}
                                                    {comment.votes?.filter(v => v.type === "UPVOTE").length || 0} {/* Updated vote count display */}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleVote(comment.id, "DOWNVOTE")}
                                                    className={`p-1 rounded hover:bg-muted ${comment.votes?.some(v => v.userId === currentUserId && v.type === "DOWNVOTE") ? "text-primary" : ""}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,133.66a8,8,0,0,1-11.32,11.32L136,78.63V216a8,8,0,0,1-16,0V78.63L53.66,145a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0Z" transform="rotate(180 128 128)"></path></svg>
                                                </button>
                                                <span className="text-xs font-medium text-red-600"> {/* Added text-red-600 */}
                                                    {comment.votes?.filter(v => v.type === "DOWNVOTE").length || 0} {/* Updated vote count display */}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                )}
            </div>

            {isAuthenticated ? (
                isLocked ? (
                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-lg text-center flex flex-col items-center gap-2">
                        <Lock className="text-red-500 h-6 w-6" />
                        <p className="text-red-500 font-medium">This discussion is locked. No more replies are allowed.</p>
                    </div>
                ) : (
                    <div className="space-y-4 pt-6 border-t font-sans" id="reply-form">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{replyingTo ? `Replying to ${replyingTo.user.name}` : "Add a reply"}</h4>
                            {replyingTo && (
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                    Cancel Quoting
                                </button>
                            )}
                        </div>
                        {replyingTo && (
                            <div className="bg-muted p-3 rounded-lg text-xs border-l-4 border-primary/50 flex flex-col gap-1">
                                <div className="font-bold text-primary/70">{replyingTo.user.name} said:</div>
                                <div className="text-muted-foreground italic line-clamp-1">"{replyingTo.content}"</div>
                            </div>
                        )}
                        <MarkdownEditor
                            value={newComment}
                            onChange={setNewComment}
                            placeholder={replyingTo ? "Write your reply..." : "Join the discussion..."}
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !newComment.trim()}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                            >
                                {isSubmitting ? "Posting..." : replyingTo ? "Post Quoted Reply" : "Post Reply"}
                            </button>
                        </div>
                    </div>
                )
            ) : (
                <div className="p-6 bg-muted/50 rounded-lg text-center">
                    <p className="text-muted-foreground">Please sign in to join the discussion.</p>
                </div>
            )}
        </div>
    );
}
