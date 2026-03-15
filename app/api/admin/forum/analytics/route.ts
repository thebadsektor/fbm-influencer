import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (session?.user?.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const [
            totalDiscussions,
            totalComments,
            topDiscussions,
            recentDiscussions,
            awaitingBatch,
            reportedCount,
            fromFeedbackCount,
            publicCount,
            privateCount,
            seoCount,
            lockedCount
        ] = await Promise.all([
            prisma.discussion.count(),
            prisma.comment.count(),
            prisma.discussion.findMany({
                take: 5,
                orderBy: { views: "desc" },
                select: {
                    id: true,
                    title: true,
                    views: true,
                    _count: {
                        select: { comments: true }
                    }
                }
            }),
            prisma.discussion.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: { name: true }
                    }
                }
            }),
            prisma.discussion.findMany({
                include: {
                    user: { select: { role: true } },
                    comments: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: {
                            user: { select: { role: true } }
                        }
                    }
                }
            }),
            prisma.discussion.count({ where: { reports: { some: {} } } }),
            prisma.discussion.count({ where: { NOT: { sourceFeedbackId: null } } }),
            prisma.discussion.count({ where: { isPublic: true } }),
            prisma.discussion.count({ where: { isPublic: false } }),
            prisma.discussion.count({ where: { isSeo: true } }),
            prisma.discussion.count({ where: { isLocked: true } }),
        ]);

        const awaitingResponseCount = awaitingBatch.filter(d => {
            const hasComments = d.comments.length > 0;
            const latestInteractionRole = hasComments
                ? d.comments[0].user.role
                : d.user.role;

            const isReplied = latestInteractionRole === "admin" || latestInteractionRole === "super-admin";
            return !isReplied;
        }).length;

        return NextResponse.json({
            totalDiscussions,
            totalComments,
            topDiscussions,
            recentDiscussions,
            awaitingResponseCount,
            reportedCount,
            fromFeedbackCount,
            publicCount,
            privateCount,
            seoCount,
            lockedCount
        });
    } catch (error) {
        console.error("Forum analytics error:", error);
        return NextResponse.json({ error: "Failed to fetch forum analytics" }, { status: 500 });
    }
}
