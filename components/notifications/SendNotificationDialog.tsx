"use client"
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bell, CircleNotch, MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";
import { sendUserNotification } from "@/app/admin/notifications/actions";
import { authClient } from "@/lib/auth-client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SendNotificationDialogProps {
    userId?: string;
    userName?: string;
    trigger?: React.ReactNode;
}

export function SendNotificationDialog({ userId: initialUserId, userName: initialUserName, trigger }: SendNotificationDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [link, setLink] = useState("");

    // User selection state
    const [selectedUserId, setSelectedUserId] = useState(initialUserId || "");
    const [userSearch, setUserSearch] = useState("");
    const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    useEffect(() => {
        if (open && !initialUserId && userSearch.length >= 2) {
            const delayDebounceFn = setTimeout(async () => {
                setSearchingUsers(true);
                try {
                    const res = await authClient.admin.listUsers({
                        query: {
                            limit: 5,
                            // Basic search - better-auth might not support direct search in listUsers query 
                            // but let's try or just filter locally if needed. 
                            // Assuming backend supports some search or we just get a few.
                        }
                    });
                    if (res.data) {
                        // Better-auth returns users, we might need to filter locally if 'search' isn't supported in listUsers
                        setUsers(res.data.users
                            .filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()) || (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())))
                            .map(u => ({ id: u.id, name: u.name || "N/A", email: u.email }))
                        );
                    }
                } catch (error) {
                    console.error("Failed to search users");
                } finally {
                    setSearchingUsers(false);
                }
            }, 300);

            return () => clearTimeout(delayDebounceFn);
        }
    }, [userSearch, open, initialUserId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) {
            toast.error("User is required");
            return;
        }
        if (!title) {
            toast.error("Title is required");
            return;
        }

        setLoading(true);
        try {
            await sendUserNotification({
                userId: selectedUserId,
                title,
                description: description || undefined,
                link: link || undefined,
            });
            toast.success(`Notification sent`);
            setOpen(false);
            // Reset form
            setTitle("");
            setDescription("");
            setLink("");
            if (!initialUserId) setSelectedUserId("");
        } catch (error) {
            toast.error("Failed to send notification");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                        <Bell size={14} className="mr-2" />
                        Send Notification
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Send Notification</DialogTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            {initialUserId ? (
                                <>Sending a notification to <strong>{initialUserName}</strong>.</>
                            ) : (
                                <>Select a user and compose your notification.</>
                            )}
                        </p>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {!initialUserId && (
                            <div className="grid gap-2">
                                <Label htmlFor="user-select" className="text-xs">Recipient User</Label>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <MagnifyingGlass className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name or email..."
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            className="pl-8 text-xs h-9"
                                        />
                                    </div>
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger className="text-xs h-9">
                                            <SelectValue placeholder={searchingUsers ? "Searching..." : "Select a user"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.length === 0 ? (
                                                <div className="p-2 text-center text-xs text-muted-foreground">
                                                    {userSearch.length < 2 ? "Type to search..." : "No users found"}
                                                </div>
                                            ) : (
                                                users.map(user => (
                                                    <SelectItem key={user.id} value={user.id} className="text-xs">
                                                        {user.name} ({user.email})
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="title" className="text-xs">Title</Label>
                            <Input
                                id="title"
                                placeholder="e.g., Account Update"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-xs"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description" className="text-xs">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                placeholder="Details about this notification..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="text-xs min-h-[100px]"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="link" className="text-xs">Link (Optional)</Label>
                            <Input
                                id="link"
                                placeholder="e.g., /dashboard/settings"
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                className="text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-xs h-8">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || (!initialUserId && !selectedUserId)} className="text-xs h-8">
                            {loading ? (
                                <>
                                    <CircleNotch size={14} className="mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send Notification"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
