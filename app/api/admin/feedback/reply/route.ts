import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { headers } from "next/headers";

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { feedbackId, replyText, images } = await req.json();

        if (!feedbackId || !replyText) {
            return NextResponse.json({ error: "Feedback ID and reply text are required" }, { status: 400 });
        }

        const feedback = await prisma.feedback.findUnique({
            where: { id: feedbackId },
        });

        if (!feedback) {
            return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
        }

        const imageHtml = images && images.length > 0
            ? `<div style="margin-top: 20px;"><strong>Attachments:</strong><br/>${images.map((img: string) => `<img src="${img}" style="max-width: 200px; margin: 5px; border-radius: 8px;" />`).join("")}</div>`
            : "";

        // Send reply email
        const subject = `Re: Your Feedback - ${feedback.source || "General"}`;
        const body = `
            <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                <p>Hello,</p>
                <p>Thank you for your feedback. An administrator has replied to your message:</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; border-left: 4px solid #0070f3; margin: 20px 0;">
                    ${replyText}
                </div>
                ${imageHtml}
                <p>---</p>
                <p>Your original feedback:</p>
                <blockquote style="color: #666; border-left: 2px solid #ddd; padding-left: 10px; font-style: italic;">
                    ${feedback.text}
                </blockquote>
                <p>Best regards,<br />The Support Team</p>
            </div>
        `;

        await sendEmail({
            to: feedback.email,
            subject,
            body,
        });

        // Save reply to database
        await prisma.feedbackReply.create({
            data: {
                feedbackId,
                text: replyText,
                images: images || [],
            },
        });

        // Update feedback status
        await prisma.feedback.update({
            where: { id: feedbackId },
            data: { status: "replied" },
        });


        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Failed to send reply:", error);
        return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
    }
}
