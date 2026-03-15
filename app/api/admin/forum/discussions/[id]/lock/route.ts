import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id || session.user.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { isLocked, lockReason } = await req.json();

        const updatedDiscussion = await prisma.discussion.update({
            where: { id },
            data: {
                isLocked,
                lockReason: isLocked ? lockReason : null
            }
        });

        return NextResponse.json(updatedDiscussion);
    } catch (error) {
        console.error("Lock toggle error:", error);
        return NextResponse.json({ error: "Failed to toggle lock" }, { status: 500 });
    }
}
