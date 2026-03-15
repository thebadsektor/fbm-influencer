"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationConfig } from "@/config/navigation";
import { useSession } from "@/lib/auth-client";
import { BookOpen, ChatCircleText, House, Shield, SquaresFour, CaretUpDown } from "@phosphor-icons/react";
import { saasMeta } from "@/lib/constants";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarFooter,
    useSidebar,
} from "@/components/ui/sidebar";
import { UserButton } from "@daveyplate/better-auth-ui";
import { cn } from "@/lib/utils";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { state } = useSidebar();
    const pathname = usePathname();
    const { data: session } = useSession();

    const filteredItems = navigationConfig.user.sidebarNav.filter((item) => {
        if (item.authRequired && !session) return false;
        if (item.publicOnly && session) return false;
        if (item.adminOnly && session?.user?.role !== "admin") return false;
        return true;
    });

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <span className="font-bold italic">{saasMeta.name.charAt(0)}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                                    <span className="font-semibold text-lg tracking-tight">{saasMeta.name}</span>
                                    {/* <span className="text-xs text-muted-foreground">Management System</span> */}
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {filteredItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            tooltip={item.label}
                                        >
                                            <Link href={item.href}>
                                                {Icon && <Icon size={20} />}
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    {session?.user?.role === "admin" && (
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild tooltip="Admin Dashboard">
                                <Link href="/admin">
                                    <SquaresFour size={20} />
                                    <span>Admin Dashboard</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )}
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Forum">
                            <Link href="/forum">
                                <ChatCircleText size={20} />
                                <span>Forum</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Documentation">
                            <Link href="/docs">
                                <BookOpen size={20} />
                                <span>Documentation</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Submit Feedback">
                            <Link href="/feedback">
                                <ChatCircleText size={20} />
                                <span>Submit Feedback</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
