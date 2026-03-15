import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        const discussion = await prisma.discussion.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                image: true,
                            }
                        }
                    },
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!discussion) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // Check visibility
        if (!discussion.isPublic) {
            if (!session?.user?.id || (session.user.id !== discussion.userId && session.user.role !== "admin")) {
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }

        // Unique view counting logic
        const ip = (await headers()).get("x-forwarded-for") || "unknown";
        const userId = session?.user?.id;

        const existingView = await prisma.discussionView.findFirst({
            where: {
                discussionId: id,
                OR: [
                    ...(userId ? [{ userId }] : []),
                    { ipAddress: ip }
                ]
            }
        });

        if (!existingView) {
            await prisma.$transaction([
                prisma.discussionView.create({
                    data: {
                        discussionId: id,
                        userId,
                        ipAddress: ip
                    }
                }),
                prisma.discussion.update({
                    where: { id },
                    data: { views: { increment: 1 } }
                })
            ]);
        }

        return NextResponse.json(discussion);
    } catch (error) {
        console.error("Discussion fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch discussion" }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const discussion = await prisma.discussion.findUnique({
            where: { id }
        });

        if (!discussion) {
            return new NextResponse("Not Found", { status: 404 });
        }

        if (discussion.userId !== session.user.id && session.user.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { title, content, isPublic } = await req.json();

        const updatedDiscussion = await prisma.discussion.update({
            where: { id },
            data: {
                title,
                content,
                isPublic,
            }
        });

        return NextResponse.json(updatedDiscussion);
    } catch (error) {
        console.error("Discussion update error:", error);
        return NextResponse.json({ error: "Failed to update discussion" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const discussion = await prisma.discussion.findUnique({
            where: { id }
        });

        if (!discussion) {
            return new NextResponse("Not Found", { status: 404 });
        }

        if (discussion.userId !== session.user.id && session.user.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        await prisma.discussion.delete({
            where: { id }
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("Discussion deletion error:", error);
        return NextResponse.json({ error: "Failed to delete discussion" }, { status: 500 });
    }
}
