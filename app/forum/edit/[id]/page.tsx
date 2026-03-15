"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Lock, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import MarkdownEditor from "@/components/forum/markdown-editor";
import { RedirectToSignIn } from "@daveyplate/better-auth-ui";

export default function EditDiscussionPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchDiscussion = async () => {
            try {
                const response = await axios.get(`/api/discussions/${id}`);
                setTitle(response.data.title);
                setContent(response.data.content);
                setIsPublic(response.data.isPublic);
            } catch (error) {
                console.error("Fetch error:", error);
                toast.error("Failed to load discussion");
                router.push("/forum");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchDiscussion();
    }, [id, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !content.trim()) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.patch(`/api/discussions/${id}`, {
                title,
                content,
                isPublic
            });
            toast.success("Discussion updated successfully!");
            router.push(`/forum/${id}`);
            router.refresh();
        } catch (error) {
            console.error("Update error:", error);
            toast.error("Failed to update discussion");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this discussion? This action cannot be undone.")) return;

        try {
            await axios.delete(`/api/discussions/${id}`);
            toast.success("Discussion deleted");
            router.push("/forum");
            router.refresh();
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete discussion");
        }
    };

    if (isLoading) return <div className="container py-20 text-center">Loading...</div>;

    return (
        <>
            <RedirectToSignIn />
            <div className="container max-w-4xl py-10 font-sans">
                <Link
                    href={`/forum/${id}`}
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
                >
                    <ArrowLeft size={16} className="mr-2" /> Back to discussion
                </Link>

                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Edit Discussion</h1>
                            <p className="text-muted-foreground">Modify your discussion details.</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Discussion Title</Label>
                            <Input
                                id="title"
                                placeholder="What's on your mind?"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-lg font-medium py-6"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Content</Label>
                            <MarkdownEditor
                                value={content}
                                onChange={setContent}
                                placeholder="Explain your discussion in detail..."
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsPublic(true)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-all ${isPublic ? "bg-primary/5 border-primary text-primary" : "hover:bg-muted"}`}
                                >
                                    <Globe size={18} />
                                    <div className="text-left">
                                        <div className="text-sm font-semibold">Public</div>
                                        <div className="text-[10px] opacity-70">Anyone can see this</div>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPublic(false)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-all ${!isPublic ? "bg-yellow-500/5 border-yellow-500 text-yellow-600" : "hover:bg-muted"}`}
                                >
                                    <Lock size={18} />
                                    <div className="text-left">
                                        <div className="text-sm font-semibold">Private</div>
                                        <div className="text-[10px] opacity-70">Only you and admins</div>
                                    </div>
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" type="button" onClick={() => router.back()}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
