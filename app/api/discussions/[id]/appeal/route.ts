import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
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

        const { reason } = await req.json();

        // Create an appeal record or just update discussion status
        // For simplicity, we'll add a 'lockUpdate' or just update the lockReason with the appeal
        await prisma.discussion.update({
            where: { id },
            data: {
                lockReason: `${discussion.lockReason} | APPEAL: ${reason}`
            }
        });

        return NextResponse.json({ message: "Appeal submitted" });
    } catch (error) {
        console.error("Appeal error:", error);
        return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 });
    }
}
