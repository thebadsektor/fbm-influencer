"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";

const LABEL_MAP: Record<string, string> = {
    "campaigns": "Campaigns",
    "kh-sets": "KH Sets",
    "credentials": "Credentials",
};

const isCuid = (s: string) => /^c[a-z0-9]{20,}$/i.test(s);

// Segments that should not be clickable (no page exists at that route)
const NON_NAVIGABLE = new Set(["kh-sets"]);

export function Breadcrumbs() {
    const pathname = usePathname();
    const paths = pathname.split("/").filter(Boolean);

    if (paths.length === 0) return null;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                        <Link href="/">Home</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {paths.map((path, index) => {
                    const href = `/${paths.slice(0, index + 1).join("/")}`;
                    const isLast = index === paths.length - 1;

                    // Determine label
                    let label: string;
                    if (LABEL_MAP[path]) {
                        label = LABEL_MAP[path];
                    } else if (isCuid(path)) {
                        label = path.slice(0, 8) + "\u2026";
                    } else {
                        label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
                    }

                    // Determine if this segment is navigable
                    const isNavigable = !NON_NAVIGABLE.has(path) && !isLast;

                    return (
                        <React.Fragment key={href}>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{label}</BreadcrumbPage>
                                ) : isNavigable ? (
                                    <BreadcrumbLink asChild>
                                        <Link href={href}>{label}</Link>
                                    </BreadcrumbLink>
                                ) : (
                                    <span className="text-muted-foreground text-sm">{label}</span>
                                )}
                            </BreadcrumbItem>
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
