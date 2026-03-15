import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/email";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id: feedbackId } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id || session.user.role !== "admin") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const feedback = await prisma.feedback.findUnique({
            where: { id: feedbackId },
            include: { user: true }
        });

        if (!feedback) {
            return new NextResponse("Feedback not found", { status: 404 });
        }

        // Create a new private discussion
        const discussion = await prisma.discussion.create({
            data: {
                title: `Private Discussion: Feedback Re: ${feedback.text.substring(0, 50)}...`,
                content: feedback.text,
                isPublic: false,
                userId: feedback.userId || session.user.id, // Assign to user if exists, otherwise admin
                sourceFeedbackId: feedback.id
            }
        });

        // Update feedback status and link to discussion
        await prisma.feedback.update({
            where: { id: feedbackId },
            data: {
                status: "replied",
                discussionId: discussion.id
            }
        });

        // Send email notification
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const discussionUrl = `${baseUrl}/forum/${discussion.id}`;

        await sendEmail({
            to: feedback.email,
            subject: "Feedback Converted to Private Discussion",
            body: `
                <p>Hello,</p>
                <p>Your feedback has been converted into a private discussion by an administrator. You can now communicate directly with us regarding this matter.</p>
                <p>Access your private discussion here: <a href="${discussionUrl}">${discussionUrl}</a></p>
                <p>Thank you!</p>
            `
        });

        return NextResponse.json(discussion);
    } catch (error) {
        console.error("Feedback conversion error:", error);
        return NextResponse.json({ error: "Failed to convert feedback" }, { status: 500 });
    }
}
