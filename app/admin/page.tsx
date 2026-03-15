"use client"

import { useState, useEffect } from "react"
import { authClient, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CircleNotch, Users, ArrowRight, Database, ChatCircleText, Megaphone, Bell } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { UserAnalytics } from "@/components/user-analytics"
import { RedirectToSignIn } from "@daveyplate/better-auth-ui"


export default function AdminDashboardPage() {
    const { data: session, isPending } = useSession()
    const router = useRouter()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSeeding, setIsSeeding] = useState(false)

    const handleSeed = async () => {
        if (!confirm("Are you sure you want to seed random data? This will add 20+ records to the forum and feedback systems.")) return;

        setIsSeeding(true)
        try {
            const res = await fetch("/api/admin/seed", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                router.refresh();
            } else {
                alert(data.error || "Failed to seed data");
            }
        } catch (error) {
            alert("An error occurred while seeding data");
        } finally {
            setIsSeeding(false)
        }
    }

    useEffect(() => {
        if (!isPending && (!session || session.user.role !== "admin")) {
            router.push("/")
        }
    }, [session, isPending, router])

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await authClient.admin.listUsers({
                query: { limit: 100 }
            })
            if (res.data) {
                setUsers(res.data.users)
            }
        } catch (error) {
            console.error("Failed to load admin data")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    if (isPending || (!session || session.user.role !== "admin")) {
        return (
            <div className="flex items-center justify-center min-h-screen text-xs">
                <CircleNotch className="h-4 w-4 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <>
            <RedirectToSignIn />
            <div className=" space-y-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
                        <p className="text-muted-foreground text-xs">Welcome back, {session.user.name}. Here's what's happening.</p>
                    </div>
                </div>

                <UserAnalytics users={users} />

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-none shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users size={20} className="text-primary" />
                                Manage Users
                            </CardTitle>
                            <CardDescription className="text-xs">
                                View, filter, and manage all registered users in your application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 mt-auto">
                            <Link href="/admin/users">
                                <Button variant="default" className="text-xs w-full">
                                    Go to User Management
                                    <ArrowRight size={14} className="ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ChatCircleText size={20} className="text-primary" />
                                Forum Management
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Moderate discussions, manage categories, and view forum analytics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 mt-auto">
                            <Link href="/admin/forum">
                                <Button variant="default" className="text-xs w-full">
                                    Manage Forum
                                    <ArrowRight size={14} className="ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Megaphone size={20} className="text-primary" />
                                Feedback System
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Review user feedback, respond to inquiries, and track bug reports.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 mt-auto">
                            <Link href="/admin/feedback">
                                <Button variant="default" className="text-xs w-full">
                                    Review Feedback
                                    <ArrowRight size={14} className="ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Bell size={20} className="text-primary" />
                                Notifications
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Manage system-wide notifications and view user alert history.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 mt-auto">
                            <Link href="/admin/notifications">
                                <Button variant="default" className="text-xs w-full">
                                    Manage Notifications
                                    <ArrowRight size={14} className="ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    {/* <Card className="border-none shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Database size={20} className="text-primary" />
                                Database Seeding
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Populate forum and feedback with 20+ random entries for testing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 mt-auto">
                            <Button
                                variant="outline"
                                className="text-xs w-full"
                                onClick={handleSeed}
                                disabled={isSeeding}
                            >
                                {isSeeding ? (
                                    <>
                                        <CircleNotch size={14} className="mr-2 animate-spin" />
                                        Seeding Data...
                                    </>
                                ) : (
                                    <>
                                        <Database size={14} className="mr-2" />
                                        Seed Random Data
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card> */}
                </div>
            </div>
        </>
    )
}
