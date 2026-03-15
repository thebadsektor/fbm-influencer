import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const feedbacks = await prisma.feedback.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                    },
                },
                replies: {
                    orderBy: {
                        createdAt: "asc",
                    },
                },
            },

        });

        return NextResponse.json(feedbacks);
    } catch (error) {
        console.error("Failed to list feedbacks:", error);
        return NextResponse.json({ error: "Failed to list feedbacks" }, { status: 500 });
    }
}
