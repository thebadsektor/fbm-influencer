"use client";

import { useSession } from "@/lib/auth-client";
import { Plans } from "@/components/subscription/Plans";
import { SubscriptionManagement } from "@/components/subscription/SubscriptionManagement";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";
import { RedirectToSignIn } from "@daveyplate/better-auth-ui";

export default function SubscriptionPage() {
    const { data: session, isPending } = useSession();

    if (isPending) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <CircleNotch className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return <RedirectToSignIn />;
    }

    return (
        <div className="container max-w-7xl mx-auto py-12 px-4 space-y-12">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                    <Sparkle size={14} weight="fill" />
                    Subscription Management
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                    Choose the right plan for your business
                </h1>
                <p className="text-muted-foreground text-lg">
                    Manage your current subscription or upgrade to unlock pro features and scale your application.
                </p>
            </div>

            <SubscriptionManagement />

            <div className="space-y-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight">Available Plans</h2>
                    <p className="text-muted-foreground text-sm">Flexible options for every stage of your journey</p>
                </div>
                <Plans />
            </div>

            <div className="bg-muted px-8 py-10 rounded-2xl border border-border/50 text-center space-y-4 max-w-4xl mx-auto">
                <h3 className="text-xl font-bold">Need a custom plan?</h3>
                <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                    If you have specific requirements or need more than what our standard plans offer, 
                    get in touch with our sales team for a custom enterprise solution.
                </p>
                <div className="pt-2 text-primary font-bold hover:underline cursor-pointer">
                    Contact Sales →
                </div>
            </div>
        </div>
    );
}
