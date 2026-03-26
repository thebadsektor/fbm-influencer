import { House, SquaresFour, Users, ChatCircleText, MagnifyingGlass, Key } from "@phosphor-icons/react";

export interface NavItem {
    label: string;
    href: string;
    icon: any;
    authRequired?: boolean;
    publicOnly?: boolean;
    adminOnly?: boolean;
}

export const navigationConfig = {
    admin: {
        mainNav: [
            {
                label: "Home",
                href: "/",
                icon: House,
            },
            {
                label: "Admin",
                href: "/admin",
                icon: SquaresFour,
                adminOnly: true,
            },
            {
                label: "Forum",
                href: "/forum",
                icon: ChatCircleText,
            },
        ] as NavItem[],
        sidebarNav: [
            {
                label: "Campaigns",
                href: "/campaigns",
                icon: MagnifyingGlass,
            },
            {
                label: "Credentials",
                href: "/credentials",
                icon: Key,
            },
            {
                label: "Manage Users",
                href: "/admin/users",
                icon: Users,
                adminOnly: true,
            },
            {
                label: "Feedback",
                href: "/admin/feedback",
                icon: ChatCircleText,
                adminOnly: true,
            },
            {
                label: "Forum Management",
                href: "/admin/forum",
                icon: ChatCircleText,
                adminOnly: true,
            },
        ] as NavItem[],
    },
    user: {
        mainNav: [
            {
                label: "Home",
                href: "/",
                icon: House,
            },
            {
                label: "Forum",
                href: "/forum",
                icon: ChatCircleText,
            },
        ] as NavItem[],
        sidebarNav: [
            {
                label: "Campaigns",
                href: "/campaigns",
                icon: MagnifyingGlass,
            },
            {
                label: "Credentials",
                href: "/credentials",
                icon: Key,
            },
        ] as NavItem[],
    }
};
