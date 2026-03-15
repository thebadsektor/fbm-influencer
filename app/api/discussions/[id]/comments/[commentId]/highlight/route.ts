import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string; commentId: string }> }
) {
    try {
        const { id, commentId } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
        });

        if (!comment) {
            return new NextResponse("Comment not found", { status: 404 });
        }

        const updatedComment = await prisma.comment.update({
            where: { id: commentId },
            data: { isHighlighted: !comment.isHighlighted } as any,
        });

        return NextResponse.json(updatedComment);
    } catch (error) {
        console.error("[COMMENT_HIGHLIGHT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
