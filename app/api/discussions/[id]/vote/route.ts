import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: discussionId } = await params;
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
        const existingVote = await prisma.discussionVote.findUnique({
            where: {
                userId_discussionId: {
                    userId,
                    discussionId
                }
            }
        });

        if (existingVote) {
            if (existingVote.type === type) {
                // Remove vote if same type (toggle off)
                await prisma.discussionVote.delete({
                    where: { id: existingVote.id }
                });
            } else {
                // Update vote if different type
                await prisma.discussionVote.update({
                    where: { id: existingVote.id },
                    data: { type }
                });
            }
        } else {
            // Create new vote
            await prisma.discussionVote.create({
                data: {
                    type,
                    userId,
                    discussionId
                }
            });
        }

        // Fetch and return updated counts
        const allVotes = await prisma.discussionVote.findMany({
            where: { discussionId }
        });

        const upvotes = allVotes.filter(v => v.type === "UPVOTE").length;
        const downvotes = allVotes.filter(v => v.type === "DOWNVOTE").length;
        const currentUserVote = await prisma.discussionVote.findUnique({
            where: { userId_discussionId: { userId, discussionId } }
        });

        return NextResponse.json({
            success: true,
            upvotes,
            downvotes,
            userVote: currentUserVote?.type || null
        });
    } catch (error) {
        console.error("Vote error:", error);
        return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
    }
}
