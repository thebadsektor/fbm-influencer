"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { 
    BookOpen, 
    Code, 
    ShieldCheck, 
    Layout, 
    Terminal, 
    FileText,
    ArrowRight,
    CheckCircle,
    Info,
    BoundingBox,
    HardDrives,
    ArrowsInSimple
} from "@phosphor-icons/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function DocsPage() {
    const [origin, setOrigin] = React.useState("https://your-domain.com");

    React.useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    return (
        <div className="max-w-5xl mx-auto py-10 px-6 space-y-12 pb-24">
            {/* Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
            >
                <div className="flex items-center gap-2 text-primary font-bold tracking-tight">
                    <BookOpen size={24} weight="duotone" />
                    <span className="text-sm uppercase tracking-widest">Documentation</span>
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                    Subscription & Gating System
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                    A comprehensive guide on managing feature access, plans, and user sessions within your SaaS application.
                </p>
            </motion.div>

            <Separator className="bg-primary/10" />

            {/* Plan Hierarchy */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <BoundingBox size={20} className="text-primary" weight="duotone" />
                    <h2 className="text-2xl font-bold">Plan Hierarchy</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { level: 0, name: "Free", color: "bg-slate-500/10 text-slate-500", desc: "Basic access for all users." },
                        { level: 1, name: "Plus", color: "bg-blue-500/10 text-blue-500", desc: "Standard premium features." },
                        { level: 2, name: "Enterprise", color: "bg-amber-500/10 text-amber-500", desc: "Full feature suite for scales." }
                    ].map((plan) => (
                        <Card key={plan.level} className="border-none bg-muted/30">
                            <CardHeader className="pb-2">
                                <div className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${plan.color}`}>
                                    Level {plan.level}
                                </div>
                                <CardTitle className="text-lg">{plan.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">{plan.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 flex gap-3 text-xs text-yellow-700 dark:text-yellow-400">
                    <Info size={18} className="shrink-0" weight="fill" />
                    <p>
                        <strong>Hierarchy Logic:</strong> The gating system uses a "greater than or equal to" approach. 
                        If a feature requires <code>plus</code> (Level 1), users on <code>enterprise</code> (Level 2) will also have access.
                    </p>
                </div>
            </section>

            {/* Implementation Details */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <Code size={20} className="text-primary" weight="duotone" />
                    <h2 className="text-2xl font-bold">Code Integration</h2>
                </div>

                <Tabs defaultValue="client" className="w-full">
                    <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                        <TabsTrigger value="client" className="data-[state=active]:border-primary data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-0 py-2 text-sm">Client-Side</TabsTrigger>
                        <TabsTrigger value="server" className="data-[state=active]:border-primary data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-0 py-2 text-sm">Server-Side</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="client" className="space-y-8 mt-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Terminal size={18} /> Hooks & Utilities
                            </h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Getting the user's active plan:</p>
                                    <pre className="bg-black/95 text-white p-4 rounded-xl text-xs overflow-x-auto border-2 border-primary/20 shadow-xl">
                                        <code>{`import { useActivePlan } from "@/lib/auth-client";

function MyComponent() {
  const { plan, loading, subscription } = useActivePlan();
  
  if (loading) return <div>Checking plan...</div>;
  
  return <div>Current Plan: {plan}</div>;
}`}</code>
                                    </pre>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Using the gating helper:</p>
                                    <pre className="bg-black/95 text-white p-4 rounded-xl text-xs overflow-x-auto border-2 border-primary/20 shadow-xl">
                                        <code>{`import { useActivePlan, gateWithPlan } from "@/lib/auth-client";

function PremiumFeature() {
  const { plan } = useActivePlan();
  const canAccess = gateWithPlan(plan, "plus");

  if (!canAccess) return <UpgradeBanner />;
  
  return <ProDashboard />;
}`}</code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="server" className="space-y-8 mt-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <HardDrives size={18} /> Server Components & APIs
                            </h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Checking plan in a Server Component:</p>
                                    <pre className="bg-black/95 text-white p-4 rounded-xl text-xs overflow-x-auto border-2 border-primary/20 shadow-xl">
                                        <code>{`import { gateWithPlanServer } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const hasAccess = await gateWithPlanServer("plus");
  
  if (!hasAccess) {
    redirect("/subscription");
  }

  return <main>Premium Server Content</main>;
}`}</code>
                                    </pre>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Getting fresh plan data:</p>
                                    <pre className="bg-black/95 text-white p-4 rounded-xl text-xs overflow-x-auto border-2 border-primary/20 shadow-xl">
                                        <code>{`import { getActivePlanServer } from "@/lib/auth";

export async function GET() {
  const plan = await getActivePlanServer();
  return Response.json({ plan });
}`}</code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </section>

            {/* Stripe Webhooks */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-primary" weight="duotone" />
                    <h2 className="text-2xl font-bold">Stripe Webhooks</h2>
                </div>
                
                <Card className="border-none bg-muted/30">
                    <CardHeader>
                        <CardTitle className="text-lg">Webhook Configuration</CardTitle>
                        <CardDescription className="text-xs">
                            To keep your database in sync with Stripe, you must set up a webhook endpoint.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <p className="text-sm font-semibold">1. Create Endpoint</p>
                            <p className="text-xs text-muted-foreground">
                                In your <a href="https://dashboard.stripe.com/webhooks" target="_blank" className="text-primary underline">Stripe Dashboard</a>, add a new endpoint pointing to:
                            </p>
                            <pre className="bg-black/95 text-white p-3 rounded-lg text-xs font-mono border border-primary/20">
                                <code>{origin}/api/auth/stripe/webhook</code>
                            </pre>
                            <p className="text-[10px] text-muted-foreground italic truncate">
                                * /api/auth is the default path for the auth server.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-semibold">2. Select Events</p>
                            <p className="text-xs text-muted-foreground">Make sure to select at least these events:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                {[
                                    "checkout.session.completed",
                                    "customer.subscription.created",
                                    "customer.subscription.updated",
                                    "customer.subscription.deleted"
                                ].map((event) => (
                                    <div key={event} className="flex items-center gap-2 text-[11px] bg-background/50 p-2 rounded border border-border">
                                        <CheckCircle size={14} className="text-green-500" weight="fill" />
                                        <code>{event}</code>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <p className="text-sm font-semibold">3. Set Environment Variable</p>
                            <p className="text-xs text-muted-foreground">
                                Save the <strong>webhook signing secret</strong> provided by Stripe and add it to your <code>.env</code>:
                            </p>
                            <pre className="bg-black/95 text-white p-3 rounded-lg text-xs font-mono border border-primary/20">
                                <code>STRIPE_WEBHOOK_SECRET=whsec_...</code>
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* File Locations */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <Layout size={20} className="text-primary" weight="duotone" />
                    <h2 className="text-2xl font-bold">Key File Locations</h2>
                </div>
                <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left py-3 px-4 font-semibold">Location</th>
                                <th className="text-left py-3 px-4 font-semibold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { path: "lib/auth.ts", desc: "Better Auth config and server helpers." },
                                { path: "lib/auth-client.ts", desc: "Client side instance and gating hooks." },
                                { path: "app/subscription/page.tsx", desc: "Public page for billing management." },
                                { path: "components/subscription/Plans.tsx", desc: "Pricing table and upgrade logic." },
                                { path: "prisma/schema.prisma", desc: "Database models for Users & Subscriptions." }
                            ].map((file) => (
                                <tr key={file.path} className="group hover:bg-muted/20 transition-colors">
                                    <td className="py-3 px-4 flex items-center gap-2 font-mono text-[11px] text-primary">
                                        <FileText size={14} className="text-muted-foreground" />
                                        {file.path}
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground text-xs">{file.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Footer / CTA */}
            <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="bg-primary/5 p-8 rounded-2xl border-2 border-dashed border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6"
            >
                <div>
                    <h3 className="text-xl font-bold">Need help with Stripe?</h3>
                    <p className="text-sm text-muted-foreground mt-1">Visit the official Stripe dashboard or Better Auth documentation.</p>
                </div>
                <div className="flex gap-4">
                    <a 
                        href="/subscription"
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                        Go to Subscription <ArrowRight />
                    </a>
                </div>
            </motion.div>
        </div>
    );
}
