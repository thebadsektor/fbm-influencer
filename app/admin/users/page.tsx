"use client"

import { useState, useEffect, useMemo } from "react"
import { authClient } from "@/lib/auth-client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
    DotsThree,
    Shield,
    Prohibit,
    CheckCircle,
    CircleNotch,
    ArrowsDownUp,
    Funnel,
    CaretLeft,
    CaretRight,
    MagnifyingGlass,
    Trash,
    Warning,
    Bell,
} from "@phosphor-icons/react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { UserInviteDialog } from "@/components/user-invite-dialog"
import { UserAnalytics } from "@/components/user-analytics"
import { SendNotificationDialog } from "@/components/notifications/SendNotificationDialog"
import { RedirectToSignIn } from "@daveyplate/better-auth-ui"

export default function AdminUsersPage() {
    const { data: session, isPending } = useSession()
    const router = useRouter()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isBanDialogOpen, setIsBanDialogOpen] = useState(false)
    const [banReasonInput, setBanReasonInput] = useState("")
    const [userToBan, setUserToBan] = useState<string | null>(null)

    // States for Search, Sort, Filter, Pagination
    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<"name" | "createdAt">("name")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
    const [filterRole, setFilterRole] = useState<string>("all")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [currentPage, setCurrentPage] = useState(1)
    const usersPerPage = 5

    useEffect(() => {
        if (!isPending && (!session || session.user.role !== "admin")) {
            router.push("/")
        }
    }, [session, isPending, router])

    const loadUsers = async () => {
        setLoading(true)
        try {
            const res = await authClient.admin.listUsers({
                query: {
                    limit: 100, // Load enough for local management for now, or use server-side pagination if needed
                }
            })
            if (res.data) {
                setUsers(res.data.users)
            }
        } catch (error) {
            toast.error("Failed to load users")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadUsers()
    }, [])

    const handleSetRole = async (userId: string, role: "user" | "admin") => {
        const res = await authClient.admin.setRole({ userId, role })
        if (res.error) {
            toast.error(res.error.message || "Failed to set role")
        } else {
            toast.success(`Role updated to ${role}`)
            loadUsers()
        }
    }

    const handleBanUser = async (userId: string, reason?: string) => {
        const res = await authClient.admin.banUser({ userId, banReason: reason })
        if (res.error) {
            toast.error(res.error.message || "Failed to ban user")
        } else {
            toast.success("User banned")
            setIsBanDialogOpen(false)
            setBanReasonInput("")
            setUserToBan(null)
            loadUsers()
        }
    }

    const handleUnbanUser = async (userId: string) => {
        const res = await authClient.admin.unbanUser({ userId })
        if (res.error) {
            toast.error(res.error.message || "Failed to unban user")
        } else {
            toast.success("User unbanned")
            loadUsers()
        }
    }

    const handleRemoveUser = async (userId: string) => {
        const res = await authClient.admin.removeUser({ userId })
        if (res.error) {
            toast.error(res.error.message || "Failed to delete user")
        } else {
            toast.success("User deleted permanently")
            loadUsers()
        }
    }

    // Memoized processed users (Filter -> Search -> Sort -> Paginate)
    const processedUsers = useMemo(() => {
        let result = [...users]

        // Filter
        if (filterRole !== "all") {
            result = result.filter((u) => u.role === filterRole)
        }
        if (filterStatus !== "all") {
            result = result.filter((u) => (filterStatus === "banned" ? u.banned : !u.banned))
        }

        // Search
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase()
            result = result.filter(
                (u) =>
                    u.email.toLowerCase().includes(lowerSearch) ||
                    (u.name && u.name.toLowerCase().includes(lowerSearch))
            )
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0
            if (sortField === "name") {
                comparison = (a.name || "").localeCompare(b.name || "")
            } else if (sortField === "createdAt") {
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            }
            return sortOrder === "asc" ? comparison : -comparison
        })

        return result
    }, [users, searchTerm, sortField, sortOrder, filterRole, filterStatus])

    // Pagination
    const totalPages = Math.ceil(processedUsers.length / usersPerPage)
    const paginatedUsers = processedUsers.slice(
        (currentPage - 1) * usersPerPage,
        currentPage * usersPerPage
    )

    const toggleSort = (field: "name" | "createdAt") => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortOrder("asc")
        }
    }

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
                        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground text-xs">Overview and user management.</p>
                    </div>
                </div>

                <UserAnalytics users={users} />

                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle className="text-lg">User Management</CardTitle>
                            <CardDescription className="text-xs">
                                Manage your users, roles, and permissions.
                            </CardDescription>
                        </div>
                        <UserInviteDialog onInviteSuccess={loadUsers} />
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or email..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                    className="pl-9 text-xs"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Select value={filterRole} onValueChange={(v) => { setFilterRole(v as string); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[130px] text-xs">
                                        <Funnel className="mr-2 h-3 w-3" />
                                        <SelectValue placeholder="Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Roles</SelectItem>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as string); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[130px] text-xs">
                                        <Funnel className="mr-2 h-3 w-3" />
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="banned">Banned</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="rounded-md border border-muted/50 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30 text-xs">
                                    <TableRow>
                                        <TableHead
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => toggleSort("name")}
                                        >
                                            <div className="flex items-center gap-1">
                                                User
                                                <ArrowsDownUp className="h-3 w-3 opacity-50" />
                                            </div>
                                        </TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => toggleSort("createdAt")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Joined
                                                <ArrowsDownUp className="h-3 w-3 opacity-50" />
                                            </div>
                                        </TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-10">
                                                <CircleNotch className="h-4 w-4 animate-spin mx-auto text-primary" />
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                                No users found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px] py-0 px-1.5">
                                                        {user.role || "user"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {user.banned ? (
                                                        <div className="flex flex-col items-start gap-1">
                                                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-normal">Banned</Badge>
                                                            {user.banReason && (
                                                                <span className="text-[10px] text-muted-foreground italic max-w-[150px] truncate" title={user.banReason}>
                                                                    "{user.banReason}"
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-100 text-[10px] py-0 px-1.5 font-normal">Active</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                <DotsThree className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="text-xs">
                                                            <DropdownMenuItem onClick={() => handleSetRole(user.id, user.role === "admin" ? "user" : "admin")}>
                                                                <Shield className="mr-2 h-3.5 w-3.5" />
                                                                {user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                                                            </DropdownMenuItem>

                                                            <SendNotificationDialog
                                                                userId={user.id}
                                                                userName={user.name || user.email}
                                                                trigger={
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                        <Bell className="mr-2 h-3.5 w-3.5" />
                                                                        Send Notification
                                                                    </DropdownMenuItem>
                                                                }
                                                            />

                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    if (user.banned) {
                                                                        handleUnbanUser(user.id)
                                                                    } else {
                                                                        setUserToBan(user.id)
                                                                        setIsBanDialogOpen(true)
                                                                    }
                                                                }}
                                                                className={user.banned ? "text-green-600 focus:text-green-600" : "text-red-600 focus:text-red-600"}
                                                            >
                                                                {user.banned ? (
                                                                    <>
                                                                        <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                                                        Unban User
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Prohibit className="mr-2 h-3.5 w-3.5" />
                                                                        Ban User
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem
                                                                        onSelect={(e) => e.preventDefault()}
                                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                                    >
                                                                        <Trash className="mr-2 h-3.5 w-3.5" />
                                                                        Delete User
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <div className="p-2 bg-red-100 rounded-full">
                                                                                <Warning className="size-5 text-red-600" weight="bold" />
                                                                            </div>
                                                                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                                                                        </div>
                                                                        <AlertDialogDescription>
                                                                            Are you sure you want to delete <strong>{user.name || user.email}</strong>?
                                                                            This action cannot be undone and will permanently remove their account and data.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-red-600 hover:bg-red-700 text-white"
                                                                            onClick={() => handleRemoveUser(user.id)}
                                                                        >
                                                                            Confirm Deletion
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4">
                                <p className="text-xs text-muted-foreground">
                                    Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, processedUsers.length)} of {processedUsers.length} users
                                </p>
                                <div className="flex gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <CaretLeft className="h-3 w-3" />
                                    </Button>
                                    <div className="flex items-center px-3 text-xs font-medium">
                                        {currentPage} / {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <CaretRight className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {/* Ban Reason Dialog */}
                <AlertDialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                    <AlertDialogContent className="sm:max-w-[425px]">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Ban User</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please provide a reason for banning this user. This will be visible to other administrators.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                            <Input
                                placeholder="Reason for ban (e.g. Terms of Service violation)"
                                value={banReasonInput}
                                onChange={(e) => setBanReasonInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleBanUser(userToBan!, banReasonInput)
                                    }
                                }}
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                                setBanReasonInput("")
                                setUserToBan(null)
                            }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleBanUser(userToBan!, banReasonInput)}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Ban User
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    )
}
