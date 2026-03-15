"use client";

import React, { useState, useRef } from "react";
import {
    Bold, Italic, Heading1, Heading2, List, ListOrdered,
    Quote, Code, Image as ImageIcon, Link as LinkIcon,
    Eye, Edit3
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import MarkdownRenderer from "./markdown-renderer";

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
    const [preview, setPreview] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const insertText = (before: string, after: string = "") => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);
        const beforeText = text.substring(0, start);
        const afterText = text.substring(end);

        const newText = `${beforeText}${before}${selected}${after}${afterText}`;
        onChange(newText);

        // Reset focus and selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
                start + before.length,
                end + before.length
            );
        }, 0);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const loadingToast = toast.loading("Uploading image...");

        try {
            const presignedResponse = await axios.post("/api/upload", {
                filename: file.name,
                contentType: file.type,
            });

            const { url, publicUrl } = presignedResponse.data;

            await axios.put(url, file, {
                headers: { "Content-Type": file.type },
            });

            insertText(`![${file.name}](${publicUrl})`, "");
            toast.success("Image uploaded successfully", { id: loadingToast });
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload image", { id: loadingToast });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="border rounded-lg overflow-hidden flex flex-col bg-background">
            <div className="flex items-center justify-between border-b bg-muted/30 p-1">
                <div className="flex items-center gap-1 flex-wrap">
                    <button
                        type="button"
                        onClick={() => insertText("**", "**")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Bold"
                    >
                        <Bold size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertText("*", "*")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Italic"
                    >
                        <Italic size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertText("# ", "")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Heading 1"
                    >
                        <Heading1 size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertText("## ", "")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Heading 2"
                    >
                        <Heading2 size={18} />
                    </button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                        type="button"
                        onClick={() => insertText("- ", "")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Bullet List"
                    >
                        <List size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertText("1. ", "")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Numbered List"
                    >
                        <ListOrdered size={18} />
                    </button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                        type="button"
                        onClick={() => insertText("> ", "")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Quote"
                    >
                        <Quote size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => insertText("`", "`")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Code"
                    >
                        <Code size={18} />
                    </button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-2 hover:bg-muted rounded transition-colors disabled:opacity-50"
                        title="Upload Image"
                    >
                        <ImageIcon size={18} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => insertText("[", "](url)")}
                        className="p-2 hover:bg-muted rounded transition-colors"
                        title="Link"
                    >
                        <LinkIcon size={18} />
                    </button>
                </div>

                <div className="flex bg-muted/50 rounded p-1">
                    <button
                        type="button"
                        onClick={() => setPreview(false)}
                        className={`px-3 py-1 text-xs font-medium rounded ${!preview ? "bg-background shadow-sm" : "hover:bg-muted"}`}
                    >
                        <div className="flex items-center gap-1">
                            <Edit3 size={14} /> Write
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreview(true)}
                        className={`px-3 py-1 text-xs font-medium rounded ${preview ? "bg-background shadow-sm" : "hover:bg-muted"}`}
                    >
                        <div className="flex items-center gap-1">
                            <Eye size={14} /> Preview
                        </div>
                    </button>
                </div>
            </div>

            <div className="relative min-h-[200px]">
                {preview ? (
                    <div className="p-4 h-full overflow-auto max-h-[500px]">
                        {value ? (
                            <MarkdownRenderer content={value} />
                        ) : (
                            <p className="text-muted-foreground italic">Nothing to preview</p>
                        )}
                    </div>
                ) : (
                    <textarea
                        ref={textAreaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder || "Write something..."}
                        className="w-full h-full min-h-[200px] p-4 bg-transparent resize-y focus:outline-none focus:ring-0 text-sm font-sans leading-relaxed"
                    />
                )}
            </div>
        </div>
    );
}
