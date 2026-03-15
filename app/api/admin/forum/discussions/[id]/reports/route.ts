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

        if (session?.user?.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const reports = await prisma.discussionReport.findMany({
            where: { discussionId: id },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                    }
                }
            },
            orderBy: { id: "desc" } // No createdAt field in schema, fallback to id
        });

        return NextResponse.json(reports);
    } catch (error) {
        console.error("Fetch reports error:", error);
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }
}
