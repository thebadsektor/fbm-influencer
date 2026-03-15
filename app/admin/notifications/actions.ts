"use server"
import prisma from "@/lib/prisma";

export async function getNotifications(params: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isRead?: boolean;
}) {
    const {
        page = 1,
        limit = 10,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        isRead
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {
        AND: [
            search ? {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { user: { name: { contains: search, mode: 'insensitive' } } },
                    { user: { email: { contains: search, mode: 'insensitive' } } },
                ]
            } : {},
            isRead !== undefined ? { isRead } : {},
        ]
    };

    const [total, items] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                }
            },
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip,
            take: limit,
        }),
    ]);

    return {
        total,
        pages: Math.ceil(total / limit),
        items,
    };
}

export async function sendUserNotification(params: {
    userId: string;
    title: string;
    description?: string;
    link?: string;
}) {
    const { userId, title, description, link } = params;

    if (!userId || !title) {
        throw new Error("User ID and Title are required");
    }

    const notification = await prisma.notification.create({
        data: {
            userId,
            title,
            description,
            link,
        },
    });

    return notification;
}

export async function getNotificationAnalytics() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const [total, read, unread, recentNotifications] = await Promise.all([
        prisma.notification.count(),
        prisma.notification.count({ where: { isRead: true } }),
        prisma.notification.count({ where: { isRead: false } }),
        prisma.notification.findMany({
            where: {
                createdAt: {
                    gte: sevenDaysAgo,
                },
            },
            select: {
                createdAt: true,
            },
        }),
    ]);

    // Format recent activity by day
    const activityMap = new Map();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dateKey = d.toLocaleDateString();
        activityMap.set(dateKey, 0);
    }

    recentNotifications.forEach((n) => {
        const dateKey = new Date(n.createdAt).toLocaleDateString();
        if (activityMap.has(dateKey)) {
            activityMap.set(dateKey, activityMap.get(dateKey) + 1);
        }
    });

    const activityData = Array.from(activityMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse();

    return {
        total,
        read,
        unread,
        activityData,
    };
}
