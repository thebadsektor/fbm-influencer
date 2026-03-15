import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import Link from "next/link";
import DiscussionCard from "@/components/forum/discussion-card";
import { SignedIn, SignedOut } from "@daveyplate/better-auth-ui";
import ForumFilters from "@/components/forum/forum-filters";

async function getDiscussions(search: string = "", page: number = 1, sort: string = "latest", filter: string = "all") {
    const limit = 10;
    const skip = (page - 1) * limit;

    const session = await auth.api.getSession({
        headers: await headers(),
    });

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
        ]
    };

    if (session?.user?.role !== "admin") {
        where.AND.push({
            OR: [
                { isPublic: true },
                ...(session?.user?.id ? [{ userId: session.user.id }] : [])
            ]
        });
    }

    const [discussions, total] = await Promise.all([
        prisma.discussion.findMany({
            where,
            include: {
                user: {
                    select: { name: true, image: true }
                },
                votes: true,
                _count: {
                    select: { comments: true }
                }
            },
            orderBy: sort === "oldest" ? { createdAt: "asc" } :
                sort === "views" ? { views: "desc" } :
                    sort === "upvotes" ? { votes: { _count: "desc" } } :
                        { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.discussion.count({ where })
    ]);

    return { discussions, total, pages: Math.ceil(total / limit) };
}

export default async function ForumPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string; sort?: string; filter?: string }>;
}) {
    const { q = "", page = "1", sort = "latest", filter = "all" } = await searchParams;
    const currentPage = parseInt(page);
    const { discussions, total, pages } = await getDiscussions(q, currentPage, sort, filter);
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    return (
        <div className="container max-w-5xl py-10 space-y-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Community Forum</h1>
                    <p className="text-muted-foreground mt-2">Join the discussion and share your thoughts.</p>
                </div>
                <SignedIn>
                    <Button asChild>
                        <Link href="/forum/create">
                            <Plus className="mr-2 h-4 w-4" /> Start Discussion
                        </Link>
                    </Button>
                </SignedIn>
                <SignedOut>
                    <Button asChild variant="outline">
                        <Link href="/auth/sign-in?redirectTo=/forum/create">Sign in to start a discussion</Link>
                    </Button>
                </SignedOut>
            </div>

            <ForumFilters initialQ={q} initialSort={sort} initialFilter={filter} />

            <div className="space-y-4">
                {discussions.length === 0 ? (
                    <div className="text-center py-20 border rounded-lg bg-muted/20">
                        <p className="text-muted-foreground">No discussions found.</p>
                    </div>
                ) : (
                    discussions.map((discussion) => (
                        <DiscussionCard key={discussion.id} discussion={discussion} />
                    ))
                )}
            </div>

            {pages > 1 && (
                <div className="flex justify-center items-center gap-2 py-8 border-t border-muted/20">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        asChild
                    >
                        <Link href={`/forum?q=${q}&page=${currentPage - 1}&sort=${sort}&filter=${filter}`}>
                            Previous
                        </Link>
                    </Button>
                    <div className="flex items-center gap-1">
                        {[...Array(pages)].map((_, i) => (
                            <Button
                                key={i}
                                variant={currentPage === i + 1 ? "default" : "ghost"}
                                size="sm"
                                className="w-9 h-9"
                                asChild
                            >
                                <Link href={`/forum?q=${q}&page=${i + 1}&sort=${sort}&filter=${filter}`}>
                                    {i + 1}
                                </Link>
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === pages}
                        asChild
                    >
                        <Link href={`/forum?q=${q}&page=${currentPage + 1}&sort=${sort}&filter=${filter}`}>
                            Next
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
