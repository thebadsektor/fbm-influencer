"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import {
    Bell,
    CreditCard
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { UserButton } from "@daveyplate/better-auth-ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";

export function Navbar() {

    return (
        <div className="flex flex-1 items-center justify-between gap-4">
            <div className="flex-1" />
            <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 mr-2">
                    <Link href="/subscription" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <CreditCard size={14} />
                        Subscription
                    </Link>
                    <ThemeToggle />
                    <NotificationPopover />
                </div>


                <div className="flex items-center gap-2">
                    <UserButton variant={"ghost"} size={"icon"} />
                </div>

            </div>
        </div>
    );
}
