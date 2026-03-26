"use client";

import { useState } from "react";
import { authClient, useSession, useActivePlan } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CircleNotch, Sparkle, Rocket, Globe } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanFeature {
    text: string;
    included: boolean;
}

interface Plan {
    id: string;
    name: string;
    description: string;
    price: string;
    priceId?: string;
    annualPriceId?: string;
    features: PlanFeature[];
    icon: any;
    popular?: boolean;
}

const plans: Plan[] = [
    {
        id: "free",
        name: "Free",
        description: "Get started with influencer scouting",
        price: "$0",
        icon: Sparkle,
        features: [
            { text: "Up to 3 campaigns", included: true },
            { text: "AI keyword generation", included: true },
            { text: "Community forum", included: true },
            { text: "Platform API keys", included: false },
            { text: "Priority support", included: false },
        ]
    },
    {
        id: "plus",
        name: "Plus",
        description: "For growing brands and agencies",
        price: "$19",
        priceId: process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MONTHLY,
        annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YEARLY,
        icon: Rocket,
        popular: true,
        features: [
            { text: "Up to 25 campaigns", included: true },
            { text: "OpenAI platform key included", included: true },
            { text: "Multi-platform scouting", included: true },
            { text: "Advanced result analytics", included: true },
            { text: "Priority support", included: false },
        ]
    },
    {
        id: "enterprise",
        name: "Enterprise",
        description: "Unlimited scouting at scale",
        price: "$99",
        priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID_MONTHLY,
        annualPriceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID_YEARLY,
        icon: Globe,
        features: [
            { text: "Everything in Plus", included: true },
            { text: "Unlimited campaigns", included: true },
            { text: "All LLM providers (Claude, GPT, Gemini)", included: true },
            { text: "Dedicated webhook endpoints", included: true },
            { text: "24/7 Priority support", included: true },
        ]
    }
];

export function Plans() {
    const { data: session } = useSession();
    const { plan: currentPlan, loading: planLoading } = useActivePlan();
    const [loading, setLoading] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

    const handleSubscribe = async (plan: Plan) => {
        if (!session) {
            toast.error("Please sign in to subscribe");
            return;
        }

        if (plan.id === "free" && currentPlan === "free") return;

        setLoading(plan.id);
        try {
            const { data, error } = await authClient.subscription.upgrade({
                plan: plan.id,
                annual: billingCycle === "yearly",
                successUrl: window.location.origin + "/subscription",
                cancelUrl: window.location.origin + "/subscription",
            });

            if (data?.url) {
                window.location.href = data.url;
            } else if (error) {
                toast.error(error.message || "Failed to initiate checkout");
            }
        } catch (err) {
            console.error(err);
            toast.error("Something went wrong");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-8 py-8">
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border">
                    <button
                        onClick={() => setBillingCycle("monthly")}
                        className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                            billingCycle === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingCycle("yearly")}
                        className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                            billingCycle === "yearly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Yearly
                        <span className="ml-1 text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-full uppercase">Save 20%</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
                {plans.map((plan) => {
                    const PlanIcon = plan.icon;
                    const isCurrent = currentPlan === plan.id;
                    const isDowngrade = plan.id === "free" && currentPlan !== "free";

                    return (
                        <Card key={plan.id} className={cn(
                            "relative flex flex-col border-2 transition-all hover:shadow-md",
                            plan.popular ? "border-primary shadow-sm" : "border-border"
                        )}>
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    Most Popular
                                </div>
                            )}
                            
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <PlanIcon size={24} weight="duotone" />
                                    </div>
                                    <CardTitle>{plan.name}</CardTitle>
                                </div>
                                <CardDescription className="text-xs min-h-[32px]">
                                    {plan.description}
                                </CardDescription>
                            </CardHeader>
                            
                            <CardContent className="flex-grow space-y-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold">
                                        {plan.id === "free" ? "$0" : billingCycle === "monthly" ? plan.price : `$${parseInt(plan.price.replace("$", "")) * 10}`}
                                    </span>
                                    <span className="text-muted-foreground text-xs">/ {billingCycle === "monthly" ? "month" : "year"}</span>
                                </div>
                                
                                <ul className="space-y-3">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-xs">
                                            {feature.included ? (
                                                <Check size={16} className="text-primary mt-0.5 shrink-0" />
                                            ) : (
                                                <Check size={16} className="text-muted-foreground/30 mt-0.5 shrink-0" />
                                            )}
                                            <span className={cn(feature.included ? "text-foreground" : "text-muted-foreground")}>
                                                {feature.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            
                            <CardFooter>
                                <Button
                                    className="w-full text-xs"
                                    variant={plan.popular ? "default" : "outline"}
                                    disabled={isCurrent || loading !== null || isDowngrade}
                                    onClick={() => handleSubscribe(plan)}
                                >
                                    {loading === plan.id ? (
                                        <CircleNotch size={14} className="animate-spin" />
                                    ) : isCurrent ? (
                                        "Current Plan"
                                    ) : isDowngrade ? (
                                        "Manage in Portal"
                                    ) : (
                                        plan.id === "free" ? "Get Started" : `Upgrade to ${plan.name}`
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
