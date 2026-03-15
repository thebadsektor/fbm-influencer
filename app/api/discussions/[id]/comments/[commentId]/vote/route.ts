import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
    req: Request,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const { commentId } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { type } = await req.json(); // UPVOTE or DOWNVOTE

        if (type !== "UPVOTE" && type !== "DOWNVOTE") {
            return new NextResponse("Invalid vote type", { status: 400 });
        }

        const userId = session.user.id;

        // Check if vote already exists
        const existingVote = await prisma.commentVote.findUnique({
            where: {
                userId_commentId: {
                    userId,
                    commentId
                }
            }
        });

        if (existingVote) {
            if (existingVote.type === type) {
                await prisma.commentVote.delete({
                    where: { id: existingVote.id }
                });
                return NextResponse.json({ message: "Vote removed" });
            } else {
                const updatedVote = await prisma.commentVote.update({
                    where: { id: existingVote.id },
                    data: { type }
                });
                return NextResponse.json(updatedVote);
            }
        }

        const vote = await prisma.commentVote.create({
            data: {
                type,
                userId,
                commentId
            }
        });

        return NextResponse.json(vote);
    } catch (error) {
        console.error("Comment vote error:", error);
        return NextResponse.json({ error: "Failed to vote on comment" }, { status: 500 });
    }
}
