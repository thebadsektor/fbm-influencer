import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const skip = (page - 1) * limit;
        const search = searchParams.get("search") || "";
        const sort = searchParams.get("sort") || "latest"; // latest, oldest, views, upvotes
        const filter = searchParams.get("filter") || "all"; // all, public, private, mine, reported, seo, locked, feedback

        const session = await auth.api.getSession({
            headers: await headers(),
        });

        const isAdmin = session?.user?.role === "admin" || session?.user?.role === "super-admin";

        // If user is admin, they can see all discussions. Otherwise, they see public ones + their own private ones.
        const where: any = {
            AND: [
                search ? {
                    OR: [
                        { title: { contains: search, mode: "insensitive" } },
                        { content: { contains: search, mode: "insensitive" } }
                    ]
                } : {},
                filter === "mine" && session?.user?.id ? { userId: session.user.id } : {},
                filter === "public" ? { isPublic: true } : {},
                filter === "private" ? { isPublic: false } : {},
                // Admin specific filters
                ...(isAdmin ? [
                    filter === "reported" ? { reports: { some: {} } } : {},
                    filter === "seo" ? { isSeo: true } : {},
                    filter === "locked" ? { isLocked: true } : {},
                    filter === "feedback" ? { NOT: { sourceFeedbackId: null } } : {},
                    // Handle 'awaiting' in-memory after fetch because Prisma can't easily filter by "latest interaction role"
                    filter === "awaiting" ? {} : {},
                ] : [])
            ]
        };

        if (!isAdmin) {
            where.AND.push({
                OR: [
                    { isPublic: true },
                    ...(session?.user?.id ? [{ userId: session.user.id }] : [])
                ]
            });
        }

        // If admin, simplify logic to see everything if requested, or just filtered
        // Admin can see everything, no need for extra OR filter

        const [discussions, total] = await Promise.all([
            prisma.discussion.findMany({
                where,
                include: {
                    user: {
                        select: {
                            name: true,
                            image: true,
                            role: true,
                        }
                    },
                    comments: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: {
                            id: true,
                            user: {
                                select: { role: true }
                            }
                        }
                    },
                    _count: {
                        select: {
                            comments: true,
                            reports: true,
                        }
                    },
                },
                orderBy: sort === "oldest" ? { createdAt: "asc" } :
                    sort === "views" ? { views: "desc" } :
                        sort === "upvotes" ? { votes: { _count: "desc" } } :
                            { createdAt: "desc" },
                skip,
                take: limit,
            } as any),
            prisma.discussion.count({ where })
        ]);

        const discussionsWithStatus = discussions.map((d: any) => {
            const hasComments = d.comments.length > 0;
            const latestInteractionRole = hasComments
                ? d.comments[0].user.role
                : d.user.role;

            const isReplied = latestInteractionRole === "admin" || latestInteractionRole === "super-admin";
            const responseStatus = isReplied ? "replied" : "awaiting";

            return {
                ...d,
                responseStatus
            };
        });

        let finalDiscussions = discussionsWithStatus;
        let finalTotal = total;

        if (isAdmin && filter === "awaiting") {
            finalDiscussions = discussionsWithStatus.filter((d: any) => d.responseStatus === "awaiting");
            // Note: total stays same for pagination simplicity, but items might be sparse
        }

        return NextResponse.json({
            discussions: finalDiscussions,
            total: finalTotal,
            pages: Math.ceil(finalTotal / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Discussions fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch discussions" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { title, content, isPublic } = await req.json();

        if (!title || !content) {
            return new NextResponse("Missing title or content", { status: 400 });
        }

        const discussion = await prisma.discussion.create({
            data: {
                title,
                content,
                isPublic: isPublic !== undefined ? isPublic : true,
                userId: session.user.id,
            },
        });

        return NextResponse.json(discussion);
    } catch (error) {
        console.error("Discussion creation error:", error);
        return NextResponse.json({ error: "Failed to create discussion" }, { status: 500 });
    }
}
