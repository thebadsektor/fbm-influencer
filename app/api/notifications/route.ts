import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const cursor = searchParams.get("cursor");

    const notifications = await prisma.notification.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].id : null;

    return NextResponse.json({
        items: notifications,
        nextCursor,
    });
}

export async function PATCH(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, markAllAsRead } = await req.json();

    if (markAllAsRead) {
        await prisma.notification.updateMany({
            where: {
                userId: session.user.id,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
        return NextResponse.json({ success: true });
    }

    if (!id) {
        return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    await prisma.notification.update({
        where: {
            id,
            userId: session.user.id,
        },
        data: {
            isRead: true,
        },
    });

    return NextResponse.json({ success: true });
}
