"use client"

import { AuthUIProvider } from "@daveyplate/better-auth-ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { authClient } from "@/lib/auth-client"
import { resizeImage } from "@/lib/utils"
import { toast } from "sonner"
import { useMinioUpload } from "@/hooks/upload"
// import { useSession } from "../lib/auth-client"


export function Providers({ children }: { children: ReactNode }) {
    const router = useRouter()
    const { uploadFile } = useMinioUpload();
    // const { data } = useSession()
    // console.log(data?.user?.id)

    return (
        <AuthUIProvider
            authClient={authClient}
            navigate={router.push}
            replace={router.replace}
            onSessionChange={() => {
                // Clear router cache (protected routes)
                router.refresh()
            }}
            social={{
                providers: ["google"]
            }}
            emailVerification
            deleteUser
            Link={Link}
            avatar={{
                upload: async (file) => {
                    // @ts-expect-error (File type error)
                    const resize: File = await resizeImage(file, 256);
                    const publicUrl = await uploadFile(resize);
                    // console.log(publicUrl);

                    toast.success("Avatar uploaded successfully!")

                    return publicUrl;
                }
            }}
        >
            {children}
        </AuthUIProvider>
    )
}