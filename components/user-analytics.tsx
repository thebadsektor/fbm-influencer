"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserGear, UserFocus, Prohibit } from "@phosphor-icons/react"

interface UserAnalyticsProps {
    users: any[]
}

export function UserAnalytics({ users }: UserAnalyticsProps) {
    const totalUsers = users.length
    const admins = users.filter((u) => u.role === "admin").length
    const banned = users.filter((u) => u.banned).length
    const activeNow = users.filter((u) => !u.banned).length

    const stats = [
        {
            title: "Total Users",
            value: totalUsers,
            icon: Users,
            color: "text-blue-500",
        },
        {
            title: "Admins",
            value: admins,
            icon: UserGear,
            color: "text-purple-500",
        },
        {
            title: "Active Users",
            value: activeNow,
            icon: UserFocus,
            color: "text-green-500",
        },
        {
            title: "Banned Users",
            value: banned,
            icon: Prohibit,
            color: "text-red-500",
        },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
                <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} weight="duotone" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
