import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (session?.user?.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { isSeo } = await req.json();

        if (isSeo === undefined) {
            return new NextResponse("Missing isSeo field", { status: 400 });
        }

        const discussion = await prisma.discussion.update({
            where: { id },
            data: { isSeo }
        });

        return NextResponse.json(discussion);
    } catch (error) {
        console.error("SEO toggle error:", error);
        return NextResponse.json({ error: "Failed to toggle SEO" }, { status: 500 });
    }
}
