import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const DISCUSSION_TITLES = [
    "How to scale Next.js apps?",
    "Best practices for Prisma migrations",
    "Tailwind CSS vs Styled Components",
    "Implementing auth with BetterAuth",
    "The future of Server Components",
    "Handling CORS in Next.js",
    "Optimizing database queries",
    "State management in 2026",
    "Using Framer Motion for SaaS",
    "PostgreSQL vs MongoDB for starters",
    "Improving Core Web Vitals",
    "Serverless vs Edge Functions",
    "Building a plugin system",
    "Accessibility in modern web",
    "Micro-frontends with Vite",
    "Caching strategies for APIs",
    "TypeScript advanced patterns",
    "Testing React components",
    "Dark mode implementation",
    "The rise of Agent UI"
];

const CONTENT_SNIPPETS = [
    "I've been wondering about the best way to handle this in a production environment. Any tips?",
    "Here is a comprehensive guide on how I solved this issue in my latest project.",
    "Does anyone have experience with this specific stack? I'm hitting some roadblocks.",
    "The performance gains are quite significant. Highly recommend checking it out.",
    "What are your thoughts on the latest update? I feel like it's a game changer.",
    "I'm seeing some inconsistent behavior across browsers. Is this a known issue?",
    "This boilerplate made my life so much easier. Here's how I configured it.",
    "Security should always be the priority. Make sure to follow these steps.",
    "Is it worth switching from the old pattern to the new one? Let's discuss.",
    "I found this great resource that explains it perfectly. Linking it below."
];

const FEEDBACK_TEXTS = [
    "The landing page looks amazing! Great job.",
    "I found a small bug in the user settings page.",
    "Can you add support for more social providers?",
    "The documentation is slightly outdated in the auth section.",
    "Love the new theme toggle! Light mode is a bit too bright though.",
    "Is there a way to export my data as CSV?",
    "The admin panel is very intuitive. Keep it up.",
    "I'm having trouble resetting my password.",
    "The forum loading speed could be improved.",
    "Thanks for the quick response to my previous ticket!",
    "Feature request: Real-time notifications.",
    "The mobile responsiveness of the forum is perfect.",
    "I'd like to see more analytics on the dashboard.",
    "How do I change my profile picture?",
    "The search filters in the forum are very helpful.",
    "Is there an API I can use for my own custom frontend?",
    "The password requirements are a bit too strict.",
    "I love the glassmorphism effects on the cards.",
    "Can we have a private category in the forum?",
    "The 'System' role logic is a bit confusing to me."
];

export async function POST() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const userEmail = session.user.email;

        // Seed Discussions
        const discussionsToCreate = DISCUSSION_TITLES.map((title, i) => ({
            title,
            content: CONTENT_SNIPPETS[i % CONTENT_SNIPPETS.length],
            userId,
            isPublic: true,
            isSeo: i % 2 === 0,
            views: Math.floor(Math.random() * 500),
        }));

        await prisma.discussion.createMany({
            data: discussionsToCreate,
        });

        // Seed Feedback
        const feedbackToCreate = FEEDBACK_TEXTS.map((text, i) => ({
            text,
            email: i % 3 === 0 ? "test@example.com" : userEmail,
            userId: i % 3 === 0 ? null : userId,
            status: i % 5 === 0 ? "replied" : "pending",
        }));

        await prisma.feedback.createMany({
            data: feedbackToCreate,
        });

        return NextResponse.json({
            success: true,
            message: `Successfully seeded ${discussionsToCreate.length} discussions and ${feedbackToCreate.length} feedback entries.`
        });

    } catch (error) {
        console.error("Seeding error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
