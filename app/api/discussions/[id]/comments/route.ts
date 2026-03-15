import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id: discussionId } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { content, parentCommentId } = await req.json();

        if (!content) {
            return new NextResponse("Missing content", { status: 400 });
        }

        const discussion = await prisma.discussion.findUnique({
            where: { id: discussionId },
            select: { isLocked: true }
        });

        if (discussion?.isLocked) {
            return new NextResponse("This discussion is locked", { status: 403 });
        }

        const comment = await prisma.comment.create({
            data: {
                content,
                discussionId,
                userId: session.user.id,
                parentCommentId: parentCommentId || null,
            },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                        role: true,
                    }
                },
                parentComment: {
                    include: {
                        user: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json(comment);
    } catch (error) {
        console.error("Comment creation error:", error);
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }
}
