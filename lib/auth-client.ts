import { adminClient, multiSessionClient, magicLinkClient } from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";
import { createAuthClient } from "better-auth/react"
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [
        adminClient(),
        multiSessionClient(),
        magicLinkClient(),
        stripeClient({
            subscription: true
        })
    ],
    fetchOptions: {
        onError(e: { error: { status: number } }) {
            if (e?.error?.status === 429) {
                toast.error("Too many requests. Please try again later.");
            }
        },
    },
})

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * Custom hook to get the user's active plan on the client.
 */
export const useActivePlan = () => {
    const { data: session } = useSession();
    const [plan, setPlan] = useState<string>("free");
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlan() {
            if (!session) {
                setPlan("free");
                setSubscription(null);
                setLoading(false);
                return;
            }

            try {
                const { data: subscriptions } = await authClient.subscription.list({
                    query: {
                        referenceId: session.user.id,
                        customerType: "user",
                    },
                });

                const activeSubscription = (subscriptions || []).find(
                    (sub: any) => sub.status === "active" || sub.status === "trialing"
                );

                setPlan(activeSubscription?.plan || "free");
                setSubscription(activeSubscription || null);
            } catch (error) {
                console.error("Error fetching active plan:", error);
                setPlan("free");
                setSubscription(null);
            } finally {
                setLoading(false);
            }
        }

        fetchPlan();
    }, [session]);

    return { plan, subscription, loading };
};

/**
 * Utility to check if a user's plan meets a requirement.
 * This can be used in components with the current plan string.
 */
export const gateWithPlan = (userPlan: string, requiredPlan: string) => {
    const planHierarchy: Record<string, number> = {
        "free": 0,
        "plus": 1,
        "enterprise": 2
    };

    return (planHierarchy[userPlan] ?? 0) >= (planHierarchy[requiredPlan] ?? 0);
};