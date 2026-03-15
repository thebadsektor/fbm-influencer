import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { RedirectToSignIn } from "@daveyplate/better-auth-ui";

export default function FeedbackPage() {
    return (
        <div className="container max-w-2xl py-10 space-y-8 font-sans">
            <RedirectToSignIn />
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Submit Feedback</h1>
                <p className="text-muted-foreground">
                    We value your input. Please let us know how we can improve.
                </p>
            </div>
            <FeedbackForm source="App Sidebar" />
        </div>
    );
}
