import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { headers } from "next/headers";

export async function POST(req: Request) {
    try {
        const { email, text, source, images } = await req.json();

        if (!text) {
            return new NextResponse("Missing feedback text", { status: 400 });
        }

        const session = await auth.api.getSession({
            headers: await headers(),
        });

        const feedback = await prisma.feedback.create({
            data: {
                email,
                text,
                source,
                ...(session?.user?.id && {
                    user: {
                        connect: {
                            id: session?.user?.id
                        }
                    }
                }),
                images: images || [],
            },
        });

        // Notify admins
        const notificationEmails = await prisma.feedbackNotificationEmail.findMany();

        if (notificationEmails.length > 0) {
            const imageHtml = feedback.images.length > 0
                ? `<div style="margin-top: 20px;"><strong>Attachments:</strong><br/>${feedback.images.map(img => `<img src="${img}" style="max-width: 200px; margin: 5px; border-radius: 8px;" />`).join("")}</div>`
                : "";

            const subject = `New Feedback`;
            const body = `
                <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <h2 style="color: #007bff;">New Feedback Received</h2>
                    <p><strong>From:</strong> ${email}</p>
                    <p><strong>Source:</strong> ${source || "N/A"}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                        ${text}
                    </div>
                    ${imageHtml}
                </div>
            `;

            await Promise.all(
                notificationEmails.map((notif) =>
                    sendEmail({
                        to: notif.email,
                        subject,
                        body,
                    })
                )
            );
        }

        return NextResponse.json(feedback);
    } catch (error) {
        console.error("Feedback submission error:", error);
        return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }
}
