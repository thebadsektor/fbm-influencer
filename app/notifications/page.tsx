"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, BellSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

interface Notification {
    id: string;
    title: string;
    description: string | null;
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const fetchNotifications = useCallback(async (cursor?: string) => {
        setLoading(true);
        try {
            const url = new URL("/api/notifications", window.location.origin);
            url.searchParams.set("limit", "20");
            if (cursor) url.searchParams.set("cursor", cursor);

            const res = await fetch(url.toString());
            const data = await res.json();

            if (cursor) {
                setNotifications((prev) => [...prev, ...data.items]);
            } else {
                setNotifications(data.items);
            }
            setNextCursor(data.nextCursor);
        } catch (error) {
            toast.error("Failed to fetch notifications");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                );
            }
        } catch (error) {
            toast.error("Failed to mark as read");
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
                    <p className="text-muted-foreground mt-1">Stay updated with your latest activities.</p>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg">Recent Notifications</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && notifications.length === 0 ? (
                        <div className="p-20 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-20 text-center text-muted-foreground">
                            <BellSlash size={48} className="mx-auto mb-4 opacity-20" />
                            <p>You don't have any notifications yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "p-6 transition-colors flex gap-4 relative",
                                        !notification.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div className="space-y-1">
                                                <h3 className="font-semibold text-base leading-snug">
                                                    {notification.link ? (
                                                        <Link href={notification.link} className="hover:underline" onClick={() => markAsRead(notification.id)}>
                                                            {notification.title}
                                                        </Link>
                                                    ) : (
                                                        notification.title
                                                    )}
                                                </h3>
                                                {notification.description && (
                                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                                        {notification.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {!notification.isRead && (
                                                    <Badge variant="default" className="text-[10px] uppercase font-bold">New</Badge>
                                                )}
                                                {!notification.isRead && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-primary hover:text-primary/80"
                                                        onClick={() => markAsRead(notification.id)}
                                                    >
                                                        <CheckCircle size={20} weight="fill" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock size={14} />
                                            <span>{new Date(notification.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {nextCursor && (
                <div className="mt-8 text-center">
                    <Button
                        variant="outline"
                        onClick={() => fetchNotifications(nextCursor)}
                        disabled={loading}
                        className="px-8"
                    >
                        {loading ? "Loading more..." : "Load More Notifications"}
                    </Button>
                </div>
            )}
        </div>
    );
}
