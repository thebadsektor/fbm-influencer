import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const emails = await prisma.feedbackNotificationEmail.findMany({
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(emails);
    } catch (error) {
        console.error("Failed to list notification emails:", error);
        return NextResponse.json({ error: "Failed to list notification emails" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const newEmail = await prisma.feedbackNotificationEmail.create({
            data: { email },
        });

        return NextResponse.json(newEmail);
    } catch (error) {
        console.error("Failed to add notification email:", error);
        return NextResponse.json({ error: "Failed to add notification email" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        await prisma.feedbackNotificationEmail.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete notification email:", error);
        return NextResponse.json({ error: "Failed to delete notification email" }, { status: 500 });
    }
}
