import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe"
import Stripe from "stripe";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { sendEmail } from "./email";
import { emailVerificationTemplate, resetPasswordTemplate, magicLinkTemplate } from "./email-templates";
import { saasMeta } from "./constants";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
})

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const count = await prisma.user.count();
                    if (count === 0) {
                        return {
                            data: {
                                ...user,
                                role: "admin",
                            }
                        };
                    }
                },
            },
        },
    },
    user: {
        deleteUser: {
            enabled: true,
        }
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        async sendResetPassword({ user, url }) {
            await sendEmail({
                to: user.email,
                subject: `${saasMeta.name} | Reset Password`,
                body: resetPasswordTemplate({ resetUrl: url }),
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, token }) => {
            const verificationUrl = `${process.env.BETTER_AUTH_URL}/api/auth/verify-email?token=${token}&callbackURL=${process.env.EMAIL_VERIFICATION_CALLBACK_URL}`;

            await sendEmail({
                to: user.email,
                subject: `${saasMeta.name} | Confirm Your Account`,
                body: emailVerificationTemplate({ verificationUrl }),
            });
        },
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    plugins: [
        admin(),
        magicLink({
            sendMagicLink: async ({ email, url }) => {
                await sendEmail({
                    to: email,
                    subject: `${saasMeta.name} | Magic Link Login`,
                    body: magicLinkTemplate({ loginUrl: url }),
                });
            },
        }),
        stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
            createCustomerOnSignUp: true,
            subscription: {
                enabled: true,
                plans: [
                    {
                        title: "Free",
                        name: "free",
                    },
                    {
                        title: "Plus",
                        name: "plus",
                        priceId: process.env.STRIPE_PLUS_PRICE_ID_MONTHLY!,
                        annualDiscountPriceId: process.env.STRIPE_PLUS_PRICE_ID_YEARLY!,
                    },
                    {
                        title: "Enterprise",
                        name: "enterprise",
                        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID_MONTHLY!,
                        annualDiscountPriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID_YEARLY!,
                    }
                ]
            }
        })
    ],
});

export const getActivePlanServer = async () => {
    const { headers } = await import("next/headers");
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || !session.user) return "free";

    const subscriptions = await auth.api.listActiveSubscriptions({
        query: {
            referenceId: session.user.id,
            customerType: "user",
        },
        headers: await headers(),
    });

    const activeSubscription = subscriptions.find(
        sub => sub.status === "active" || sub.status === "trialing"
    );

    return activeSubscription?.plan || "free";
};

export const gateWithPlanServer = async (planName: string) => {
    const userPlan = await getActivePlanServer();
    
    const planHierarchy: Record<string, number> = {
        "free": 0,
        "plus": 1,
        "enterprise": 2
    };

    return (planHierarchy[userPlan] ?? 0) >= (planHierarchy[planName] ?? 0);
};
