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

        const { reason } = await req.json();
        const userId = session.user.id;

        // Create report
        await prisma.discussionReport.create({
            data: {
                reason,
                userId,
                discussionId
            }
        });

        // Check for auto-locking
        const reportsCount = await prisma.discussionReport.count({
            where: { discussionId }
        });

        const upvotesCount = await prisma.discussionVote.count({
            where: { discussionId, type: "UPVOTE" }
        });

        if (reportsCount >= 5 && reportsCount > upvotesCount) {
            await prisma.discussion.update({
                where: { id: discussionId },
                data: {
                    isLocked: true,
                    lockReason: "Automatically locked due to multiple reports."
                }
            });
        }

        return NextResponse.json({ message: "Report submitted" });
    } catch (error) {
        console.error("Report error:", error);
        return NextResponse.json({ error: "Failed to report" }, { status: 500 });
    }
}
