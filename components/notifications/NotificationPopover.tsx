"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, Clock, ArrowRight } from "@phosphor-icons/react";
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

export function NotificationPopover() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    const fetchNotifications = useCallback(async (cursor?: string) => {
        setLoading(true);
        try {
            const url = new URL("/api/notifications", window.location.origin);
            url.searchParams.set("limit", "10");
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

    const markAllAsRead = async () => {
        try {
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                body: JSON.stringify({ markAllAsRead: true }),
            });
            if (res.ok) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                toast.success("All notifications marked as read");
            }
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="p-2 rounded-full hover:bg-muted transition-colors relative">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-background"></span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={markAllAsRead}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 && !loading ? (
                        <div className="p-8 text-center text-muted-foreground text-xs">
                            No notifications yet.
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "p-4 border-b last:border-0 transition-colors flex gap-3 group relative",
                                        !notification.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="text-xs font-medium leading-tight line-clamp-2">
                                                {notification.link ? (
                                                    <Link href={notification.link} className="hover:underline" onClick={() => markAsRead(notification.id)}>
                                                        {notification.title}
                                                    </Link>
                                                ) : (
                                                    notification.title
                                                )}
                                            </h4>
                                            {!notification.isRead && (
                                                <button
                                                    onClick={() => markAsRead(notification.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80"
                                                    title="Mark as read"
                                                >
                                                    <CheckCircle size={14} weight="fill" />
                                                </button>
                                            )}
                                        </div>
                                        {notification.description && (
                                            <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                                                {notification.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                            <Clock size={12} />
                                            <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {nextCursor && (
                        <div className="p-2 border-t text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-xs"
                                onClick={() => fetchNotifications(nextCursor)}
                                disabled={loading}
                            >
                                {loading ? "Loading..." : "Load more"}
                            </Button>
                        </div>
                    )}
                </div>
                <div className="p-2 border-t bg-muted/10">
                    <Button variant="ghost" size="sm" className="w-full h-8 text-xs group" asChild>
                        <Link href="/notifications">
                            View All Notifications
                            <ArrowRight size={12} className="ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
