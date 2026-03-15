"use client";

import { Button } from "@/components/ui/button";

interface AppealButtonProps {
    discussionId: string;
}

export default function AppealButton({ discussionId }: AppealButtonProps) {
    const handleAppeal = async () => {
        const reason = prompt("Describe why your discussion should be unlocked:");
        if (!reason) return;

        try {
            const response = await fetch(`/api/discussions/${discussionId}/appeal`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ reason })
            });

            if (response.ok) {
                alert("Appeal submitted to administrators.");
            } else {
                alert("Failed to submit appeal.");
            }
        } catch (err) {
            alert("Failed to submit appeal.");
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-100"
            onClick={handleAppeal}
        >
            Appeal Lockdown
        </Button>
    );
}
