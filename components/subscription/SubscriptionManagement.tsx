"use client";

import { useState } from "react";
import { authClient, useSession, useActivePlan } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ArrowSquareOut, CircleNotch, CalendarCheck, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { format } from "date-fns";

export function SubscriptionManagement() {
    const { data: session } = useSession();
    const { plan: currentPlan, subscription, loading: planLoading } = useActivePlan();
    const [loadingPortal, setLoadingPortal] = useState(false);

    if (!session?.user) return null;

    const handlePortal = async () => {
        setLoadingPortal(true);
        try {
            const { data, error } = await authClient.subscription.billingPortal({
                returnUrl: window.location.href
            });
            if (data?.url) {
                window.location.href = data.url;
            } else if (error) {
                toast.error(error.message || "Failed to open billing portal");
            }
        } catch (err) {
            console.error(err);
            toast.error("Something went wrong");
        } finally {
            setLoadingPortal(false);
        }
    };

    return (
        <Card className="border-none shadow-sm bg-muted/30">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard size={20} className="text-primary" />
                            Current Subscription
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Manage your billing and plan details
                        </CardDescription>
                    </div>
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase">
                        {currentPlan} Plan
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-xs">
                            <CalendarCheck size={18} className="text-muted-foreground" />
                            <div>
                                <p className="font-medium">Status</p>
                                <p className="text-muted-foreground">
                                    {subscription?.status === "active" ? "Active and paid" : currentPlan === "free" ? "Always Free" : "Action Required"}
                                </p>
                            </div>
                        </div>

                        {subscription?.currentPeriodEnd && (
                            <div className="flex items-center gap-3 text-xs">
                                <ShieldCheck size={18} className="text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Next Billing Date</p>
                                    <p className="text-muted-foreground">
                                        {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col justify-center">
                        {currentPlan !== "free" ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs w-full md:w-auto ml-auto"
                                onClick={handlePortal}
                                disabled={loadingPortal}
                            >
                                {loadingPortal ? (
                                    <CircleNotch size={14} className="animate-spin mr-2" />
                                ) : (
                                    <ArrowSquareOut size={14} className="mr-2" />
                                )}
                                Manage Billing in Stripe
                            </Button>
                        ) : (
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground italic">Upgrade below to unlock premium features</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
