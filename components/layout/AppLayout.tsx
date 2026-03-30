"use client";

import { Navbar } from "./Navbar";
import { AppSidebar } from "./app-sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Exclude layout on auth pages
    const isAuthPage = pathname?.startsWith("/auth");

    if (isAuthPage) {
        return <main className="min-h-screen bg-background flex items-center justify-center">{children}</main>;
    }

    return (
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b px-4">
                        <div className="flex items-center gap-2 w-full">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />
                            <div className="flex-1">
                                <Navbar />
                            </div>
                        </div>
                    </header>
                    <div className="flex items-center px-4 py-2 border-b bg-muted/20">
                        <Breadcrumbs />
                    </div>
                    <main className="flex flex-1 flex-col gap-4 p-4 pt-0">
                        <div className="mx-auto w-full max-w-7xl pt-4">
                            {children}
                        </div>
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}
