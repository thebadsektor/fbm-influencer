import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function DELETE(
    req: Request,
    { params }: { params: { id: string; commentId: string } }
) {
    try {
        const { commentId } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id || session.user.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        await prisma.comment.delete({
            where: { id: commentId }
        });

        return NextResponse.json({ success: true, message: "Comment deleted" });
    } catch (error) {
        console.error("Comment deletion error:", error);
        return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }
}
