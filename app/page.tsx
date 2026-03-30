"use client";

import Link from "next/link";
import {
    ArrowRight,
    MagnifyingGlass,
    Lightning,
    Users,
    Robot,
    ChartLineUp,
    Megaphone,
    CreditCard,
    Code,
    EnvelopeSimple,
} from "@phosphor-icons/react";
import { SignedIn, SignedOut } from "@daveyplate/better-auth-ui";
import { motion } from "framer-motion";
import { saasMeta } from "@/lib/constants";
import Dashboard from "@/components/dashboard/Dashboard";

const features = [
    {
        name: "AI-Powered Search",
        description: "Generate smart keywords and hashtags using GPT, Claude, or Gemini.",
        icon: <Robot size={24} weight="duotone" className="text-orange-500" />,
    },
    {
        name: "Multi-Platform",
        description: "Scout creators on YouTube and TikTok simultaneously.",
        icon: <Users size={24} weight="duotone" className="text-amber-500" />,
    },
    {
        name: "n8n Automation",
        description: "Trigger discovery workflows that scrape, enrich, and deliver results.",
        icon: <Lightning size={24} weight="duotone" className="text-yellow-500" />,
    },
    {
        name: "Creator Profiles",
        description: "Email, engagement rate, follower count, and confidence scores.",
        icon: <EnvelopeSimple size={24} weight="duotone" className="text-emerald-500" />,
    },
    {
        name: "Campaign Management",
        description: "Organize scouting by brand, niche, audience, and goal.",
        icon: <Megaphone size={24} weight="duotone" className="text-sky-500" />,
    },
    {
        name: "Subscription Plans",
        description: "Free, Plus, and Enterprise tiers with Stripe billing.",
        icon: <CreditCard size={24} weight="duotone" className="text-rose-500" />,
    }
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1
    }
};

export default function LandingPage() {
    return (
        <>
        <SignedIn>
            <Dashboard />
        </SignedIn>
        <SignedOut>
        <div className="flex flex-col gap-24 py-12 overflow-hidden font-sans selection:bg-primary/30">
            {/* Ambient Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1000px] pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-5%] left-1/4 w-[600px] h-[600px] bg-primary/20 blur-[130px] rounded-full animate-pulse opacity-50"></div>
                <div className="absolute top-[15%] right-1/4 w-[500px] h-[500px] bg-amber-500/20 blur-[110px] rounded-full animate-pulse delay-700 opacity-50"></div>
            </div>

            {/* Hero Section */}
            <section className="relative text-center space-y-10 max-w-5xl mx-auto px-6 pt-12">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-primary/5 border border-primary/10 text-primary text-xs font-bold tracking-widest uppercase shadow-sm"
                >
                    <MagnifyingGlass weight="bold" />
                    <span>AI-Powered Influencer Discovery</span>
                </motion.div>

                <div className="space-y-6">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] text-foreground"
                    >
                        Find your next <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-500 to-yellow-400">brand ambassador.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
                    >
                        Scout creators, generate smart keywords, and build influencer funnels — all powered by AI.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="flex flex-wrap justify-center gap-5"
                >
                    <SignedIn>
                        <Link
                            href="/campaigns"
                            className="group relative flex items-center gap-3 bg-primary text-primary-foreground px-10 py-5 rounded-2xl font-bold text-lg transition-all hover:shadow-[0_0_40px_rgba(var(--primary),0.2)] hover:-translate-y-1 active:scale-95"
                        >
                            Open Dashboard
                            <ArrowRight weight="bold" className="transition-transform group-hover:translate-x-1" />
                        </Link>
                    </SignedIn>
                    <SignedOut>
                        <Link
                            href="/auth/sign-up"
                            className="group relative flex items-center gap-3 bg-primary text-primary-foreground px-10 py-5 rounded-2xl font-bold text-lg transition-all hover:shadow-[0_0_40px_rgba(var(--primary),0.2)] hover:-translate-y-1 active:scale-95"
                        >
                            Start Scouting
                            <ArrowRight weight="bold" className="transition-transform group-hover:translate-x-1" />
                        </Link>
                    </SignedOut>
                    <Link
                        href="#features"
                        className="flex items-center gap-3 bg-card border border-border px-10 py-5 rounded-2xl font-bold text-lg transition-all hover:bg-muted/50 hover:border-border hover:-translate-y-1 active:scale-95 shadow-lg"
                    >
                        See Features
                    </Link>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="pt-16 flex flex-wrap justify-center items-center gap-x-10 gap-y-6 opacity-30 font-mono text-xs uppercase tracking-[0.2em] font-bold"
                >
                    <span>AI Scouting</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                    <span>YouTube + TikTok</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                    <span>n8n Automation</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                    <span>Stripe Billing</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                    <span>Creator CRM</span>
                </motion.div>
            </section>

            {/* Features Grid */}
            <section id="features" className="container max-w-7xl mx-auto px-6 space-y-16">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight">Everything You Need to Scout.</h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                        Stop spending hours on manual influencer research.
                        AI-powered keyword generation, automated workflows, and creator analytics — all in one place.
                    </p>
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className="group p-8 rounded-[2rem] border bg-card/40 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 border-border/50 overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <span className="text-8xl font-black select-none pointer-events-none">{idx + 1}</span>
                            </div>

                            <div className="relative z-10 space-y-6">
                                <div className="p-4 bg-primary/5 w-fit rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 border border-primary/10">
                                    {feature.icon}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold tracking-tight">{feature.name}</h3>
                                    <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Built for Marketers Section */}
            <section className="container max-w-7xl mx-auto px-6">
                <div className="relative bg-zinc-950 p-10 md:p-24 rounded-[3.5rem] overflow-hidden border border-white/[0.05] shadow-3xl">
                    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 blur-[180px] -mr-[400px] -mt-[400px] rounded-full"></div>
                    <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-amber-500/10 blur-[180px] -ml-[400px] -mb-[400px] rounded-full"></div>

                    <div className="relative z-10 grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-10">
                            <div className="inline-flex items-center gap-3 text-primary font-mono text-xs uppercase tracking-[0.3em] font-black">
                                <span className="block h-[1px] w-12 bg-current"></span>
                                Automate the boring parts
                            </div>
                            <h2 className="text-4xl md:text-7xl font-black text-white leading-[0.95] tracking-tighter">
                                Built for <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-orange-600 italic">Marketers.</span>
                            </h2>
                            <p className="text-zinc-400 text-xl leading-relaxed max-w-md font-medium">
                                Running influencer campaigns usually means hours of manual research.
                                We automate the boring parts.
                            </p>

                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <div className="text-white text-4xl font-black tabular-nums">3</div>
                                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">LLM Providers</div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-white text-4xl font-black tabular-nums">2</div>
                                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Platforms (YT + TT)</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] backdrop-blur-2xl rounded-[2.5rem] p-1 border border-white/[0.05] shadow-premium group">
                            <div className="bg-[#0b0b0e] rounded-[2.2rem] p-4 md:p-8 space-y-6">
                                <div className="flex items-center justify-between text-zinc-600 border-b border-white/[0.03] pb-4 mb-2">
                                    <div className="flex items-center gap-3">
                                        <Code size={18} />
                                        <span className="text-xs font-mono font-bold uppercase tracking-widest">campaign payload</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                                    </div>
                                </div>
                                <pre className="text-amber-300 font-mono text-xs leading-relaxed overflow-x-auto p-2">
                                    {`{
  "Brand Niche": "Eco Skincare",
  "Goal": "Brand Awareness",
  "Audience": "25-34, US",
  "Keywords": ["clean beauty",
               "organic skincare"],
  "Hashtags": ["#cleanbeauty",
               "#ecofriendly"],
  "Platform": "youtube"
}`}
                                </pre>
                                <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                                    <div className="flex items-center gap-3 group/item">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-xs text-zinc-400 font-bold tracking-wide uppercase">AI Keyword Generation</span>
                                    </div>
                                    <div className="flex items-center gap-3 group/item">
                                        <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                        <span className="text-xs text-zinc-400 font-bold tracking-wide uppercase">Automated Discovery</span>
                                    </div>
                                    <div className="flex items-center gap-3 group/item">
                                        <div className="h-2 w-2 rounded-full bg-zinc-700"></div>
                                        <span className="text-xs text-zinc-400 font-bold tracking-wide uppercase">Email Enrichment</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="container max-w-4xl mx-auto px-6 text-center py-20">
                <div className="space-y-12 bg-gradient-to-b from-card to-background p-16 rounded-[4rem] border border-border/40 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/[0.02] -z-10"></div>
                    <div className="space-y-6">
                        <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
                            Ready to find creators? <br />
                            <span className="text-primary italic">Start now.</span>
                        </h2>
                        <p className="text-xl text-muted-foreground font-medium">
                            Create your first campaign and let AI do the scouting.
                        </p>
                    </div>
                    <div className="flex justify-center">
                        <Link
                            href="/auth/sign-up"
                            className="flex items-center gap-4 bg-foreground text-background px-12 py-6 rounded-[1.5rem] font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl"
                        >
                            Start Scouting
                            <ArrowRight weight="bold" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="container max-w-7xl mx-auto px-6 py-16 border-t border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2 space-y-6">
                        <div className="flex items-center gap-2 italic font-black text-2xl tracking-tighter text-foreground">
                            {saasMeta.name}
                        </div>
                        <p className="text-muted-foreground text-sm max-w-sm leading-relaxed font-medium">
                            AI-powered influencer scouting platform. Find creators, generate keywords, and build your funnel.
                        </p>
                    </div>
                    <div className="space-y-6">
                        <h4 className="font-bold text-xs uppercase tracking-widest">Platform</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                            <li><Link href="/campaigns" className="hover:text-primary transition-colors">Campaigns</Link></li>
                            <li><Link href="/forum" className="hover:text-primary transition-colors">Forum</Link></li>
                            <li><Link href="/feedback" className="hover:text-primary transition-colors">Feedback</Link></li>
                            <li><Link href="/auth/sign-in" className="hover:text-primary transition-colors">Sign In</Link></li>
                        </ul>
                    </div>
                    <div className="space-y-6">
                        <h4 className="font-bold text-xs uppercase tracking-widest">Integrations</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                            <li>YouTube</li>
                            <li>TikTok</li>
                            <li>n8n</li>
                            <li>Stripe</li>
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-muted-foreground text-xs font-bold uppercase tracking-widest border-t border-border/20 pt-10">
                    <div>
                        &copy; {new Date().getFullYear()} {saasMeta.name}. All rights reserved.
                    </div>
                    <div className="flex gap-10">
                        <Link href="#" className="hover:text-primary transition-colors">Twitter</Link>
                        <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
                        <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
        </SignedOut>
        </>
    );
}
