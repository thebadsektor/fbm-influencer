import { House, SquaresFour, ShieldCheck, UserCircle, Gear, Shield, Users, ChatCircleText } from "@phosphor-icons/react";

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
                label: "Public Content",
                href: "/public-demo",
                icon: SquaresFour,
            },
            {
                label: "Forum",
                href: "/forum",
                icon: ChatCircleText,
            },
        ] as NavItem[],
        sidebarNav: [
            {
                label: "Home",
                href: "/",
                icon: House,
            },
        ] as NavItem[],
    }
};
