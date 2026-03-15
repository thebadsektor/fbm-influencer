"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
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
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { UserPlus, CircleNotch } from "@phosphor-icons/react"
import { nanoid } from "nanoid"

interface UserInviteDialogProps {
    onInviteSuccess: () => void
}

export function UserInviteDialog({ onInviteSuccess }: UserInviteDialogProps) {
    const [emails, setEmails] = useState("")
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    const handleInvite = async () => {
        const emailList = emails
            .split(",")
            .map((e) => e.trim())
            .filter((e) => e !== "")

        if (emailList.length === 0) {
            toast.error("Please enter at least one email")
            return
        }

        setLoading(true)
        try {
            const results = await Promise.all(
                emailList.map(async (email) => {
                    const password = nanoid(12)
                    const createUser = await authClient.admin.createUser({
                        email,
                        password,
                        name: email.split("@")[0],
                        role: "user"
                    })

                    if (!createUser.error) {
                        // Send magic link for onboarding
                        await authClient.signIn.magicLink({
                            email,
                            callbackURL: "/",
                        })
                    }
                    return createUser
                })
            )

            const failures = results.filter((r) => r.error)

            if (failures.length > 0) {
                toast.error(`Failed to invite ${failures.length} user(s)`)
            } else {
                toast.success(`Successfully invited ${emailList.length} user(s)`)
                setEmails("")
                setOpen(false)
                onInviteSuccess()
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" weight="bold" />
                    Invite Users
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Invite Users</AlertDialogTitle>
                    <AlertDialogDescription>
                        Enter email addresses separated by commas to invite multiple users at once.
                        Temporary passwords will be set automatically.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="user1@example.com, user2@example.com..."
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <Button onClick={handleInvite} disabled={loading}>
                        {loading && <CircleNotch className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invitations
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
