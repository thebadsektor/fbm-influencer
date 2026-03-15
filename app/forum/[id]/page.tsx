import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { formatDistanceToNow } from "date-fns";
import { User, Calendar, Eye, ArrowLeft, Edit, ThumbsUp, ThumbsDown, Flag, Lock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import MarkdownRenderer from "@/components/forum/markdown-renderer";
import CommentSection from "@/components/forum/comment-section";
import DiscussionActions from "@/components/forum/discussion-actions";
import AdminModerationDashboard from "@/components/forum/admin-moderation-dashboard";
import AppealButton from "@/components/forum/appeal-button";
import { SignedIn, SignedOut, RedirectToSignIn } from "@daveyplate/better-auth-ui";
async function getDiscussion(id: string) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    const discussion = await prisma.discussion.findUnique({
        where: { id },
        include: {
            user: {
                select: { name: true, image: true, role: true }
            },
            votes: true,
            reports: true,
            comments: {
                include: {
                    user: {
                        select: { name: true, image: true, role: true }
                    },
                    parentComment: {
                        include: {
                            user: {
                                select: { name: true }
                            }
                        }
                    },
                    votes: true
                },
                orderBy: { createdAt: "asc" }
            },
            _count: {
                select: {
                    comments: true,
                    reports: true,
                }
            }
        }
    });

    if (!discussion) return null;

    // Fetch user vote
    let userVote = null;
    if (session?.user?.id) {
        userVote = await prisma.discussionVote.findUnique({
            where: {
                userId_discussionId: {
                    userId: session.user.id,
                    discussionId: id
                }
            }
        });
    }

    const upvotes = discussion.votes.filter(v => v.type === "UPVOTE").length;
    const downvotes = discussion.votes.filter(v => v.type === "DOWNVOTE").length;

    // Check visibility
    if (!discussion.isPublic) {
        if (!session?.user?.id || (session.user.id !== discussion.userId && session.user.role !== "admin" && session.user.role !== "super-admin")) {
            return null;
        }
    }

    // Increment views
    await prisma.discussion.update({
        where: { id },
        data: { views: { increment: 1 } }
    });

    return { discussion, session, userVote, upvotes, downvotes };
}

export default async function DiscussionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const data = await getDiscussion(id);

    if (!data) notFound();

    const { discussion, session, userVote, upvotes, downvotes } = data;
    const isAuthor = session?.user?.id === discussion.userId;
    const isAdmin = session?.user?.role === "admin" || session?.user?.role === "super-admin";

    return (
        <div className="container max-w-4xl py-10 font-sans">
            <Link
                href="/forum"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
            >
                <ArrowLeft size={16} className="mr-2" /> Back to forum
            </Link>

            {isAdmin && <AdminModerationDashboard discussion={discussion} isAdmin={isAdmin} />}

            <article className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <h1 className="text-4xl font-extrabold tracking-tight">{discussion.title}</h1>
                        <SignedIn>
                            {isAuthor && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/forum/edit/${discussion.id}`}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </Link>
                                </Button>
                            )}
                        </SignedIn>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b pb-6">
                        <div className="flex items-center gap-2">
                            {discussion.user.image ? (
                                <img
                                    src={discussion.user.image}
                                    alt={discussion.user.name}
                                    className="w-6 h-6 rounded-full"
                                />
                            ) : (
                                <User size={16} />
                            )}
                            <div className="flex flex-col">
                                <span className="font-medium text-foreground">{discussion.user.name}</span>
                                {discussion.user.role !== "user" && (
                                    <span className="text-[10px] uppercase text-primary font-bold">{discussion.user.role}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar size={16} />
                            <span>{formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Eye size={16} />
                            <span>{discussion.views} views</span>
                        </div>
                    </div>
                </div>

                {discussion.isLocked && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-6 flex gap-4 items-start">
                        <Lock className="text-red-600 shrink-0 mt-1" />
                        <div className="space-y-2">
                            <h3 className="font-bold text-red-800">This discussion is locked</h3>
                            <p className="text-red-700 text-sm">{discussion.lockReason || "This discussion has been locked due to multiple reports."}</p>
                            {isAuthor && (
                                <AppealButton discussionId={discussion.id} />
                            )}
                        </div>
                    </div>
                )}

                <div className="py-4">
                    <MarkdownRenderer content={discussion.content} />
                </div>

                {discussion.sourceFeedbackId && isAdmin && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-800 text-sm">
                            <span className="font-bold">Admin Note:</span>
                            <span>This discussion was converted from feedback.</span>
                        </div>
                        <Button variant="outline" size="sm" asChild className="border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100 transition-all">
                            <Link href="/admin/feedback">
                                View Feedback Management
                            </Link>
                        </Button>
                    </div>
                )}

                <DiscussionActions
                    discussionId={discussion.id}
                    initialUpvotes={upvotes}
                    initialDownvotes={downvotes}
                    initialUserVote={userVote?.type || null}
                    isAuthenticated={!!session}
                />
            </article>

            <CommentSection
                discussionId={discussion.id}
                initialComments={discussion.comments.map(c => ({
                    ...c,
                    createdAt: c.createdAt.toISOString(),
                    parentComment: c.parentComment
                }))}
                isAuthenticated={!!session?.user}
                currentUserId={session?.user?.id}
                userRole={session?.user?.role || undefined}
                isLocked={discussion.isLocked}
            />
        </div>
    );
}
