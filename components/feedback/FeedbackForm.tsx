"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MarkdownEditor from "@/components/forum/markdown-editor";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { PaperPlaneTilt, CircleNotch, Image as ImageIcon, X, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface FeedbackFormProps {
    source?: string;
    className?: string;
}

export function FeedbackForm({ source, className }: FeedbackFormProps) {
    const { data: session } = useSession();
    const [email, setEmail] = useState("");
    const [text, setText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [images, setImages] = useState<{ key: string; url: string; file: File }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (session?.user?.email) {
            setEmail(session.user.email);
        }
    }, [session]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const newImages = [...images];

        for (const file of Array.from(files)) {
            if (!file.type.startsWith("image/")) {
                toast.error(`${file.name} is not an image file.`);
                continue;
            }

            try {
                // 1. Get presigned URL
                const res = await fetch("/api/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type,
                    }),
                });

                if (!res.ok) throw new Error("Failed to get upload URL");

                const { url, publicUrl, key } = await res.json();

                // 2. Upload to MinIO
                await fetch(url, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });

                newImages.push({ key, url: publicUrl, file });
            } catch (error) {
                console.error("Upload error:", error);
                toast.error(`Failed to upload ${file.name}`);
            }
        }

        setImages(newImages);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !text) {
            toast.error("Please fill in all fields.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    text,
                    source: source || "General",
                    images: images.map(img => img.url),
                }),
            });

            if (res.ok) {
                toast.success("Feedback submitted successfully. Thank you!");
                setIsSubmitted(true);
                setText("");
                setImages([]);
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to submit feedback.");
            }
        } catch (error) {
            toast.error("An error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <Card className={cn("border-none shadow-premium bg-gradient-to-br from-background to-muted/20 py-10", className)}>
                <CardContent className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                        <CheckCircle size={40} weight="fill" className="text-emerald-500" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold tracking-tight">Feedback Received!</h3>
                        <p className="text-sm text-muted-foreground">
                            Thank you for helping us improve. We'll review your feedback soon.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSubmitted(false)}
                        className="text-xs text-primary hover:bg-primary/5 rounded-xl px-6"
                    >
                        Send more feedback
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("border-none shadow-premium bg-gradient-to-br from-background to-muted/20", className)}>
            <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight">Send Feedback</CardTitle>
                <CardDescription className="text-xs">
                    We'd love to hear from you! Your feedback helps us improve.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground ml-1">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={!!session?.user?.email}
                            className="bg-muted/30 border-muted-foreground/10 h-10 px-4"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="text" className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground ml-1">Your Message</Label>
                        <MarkdownEditor
                            value={text}
                            onChange={(newValue) => setText(newValue)}
                            placeholder="Tell us what's on your mind..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground ml-1">Attachments</Label>
                        <div className="flex flex-wrap gap-2">
                            {images.map((img, index) => (
                                <div key={img.key} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-muted-foreground/10">
                                    <img src={img.url} alt="preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 bg-black/50 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} weight="bold" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-16 h-16 rounded-lg border border-dashed border-muted-foreground/20 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
                            >
                                {isUploading ? (
                                    <CircleNotch className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <>
                                        <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-[8px] mt-1 text-muted-foreground uppercase font-bold group-hover:text-primary">Add</span>
                                    </>
                                )}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                multiple
                                className="hidden"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-11 transition-all hover:scale-[1.01] active:scale-[0.99] font-medium"
                        disabled={isSubmitting || isUploading}
                    >
                        {isSubmitting ? (
                            <CircleNotch className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <PaperPlaneTilt className="h-4 w-4 mr-2" weight="bold" />
                        )}
                        {isSubmitting ? "Sending..." : "Send Feedback"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

