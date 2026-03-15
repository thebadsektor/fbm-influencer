"use client"
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
    content: string;
    status?: 'streaming' | 'done';
}

export default function MarkdownRenderer({ content, status = 'done' }: MarkdownRendererProps) {
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none 
            prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl 
            prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border
            prose-img:rounded-lg prose-a:text-primary hover:prose-a:underline">
            <Streamdown
                plugins={{ code, mermaid, math, cjk }}
                isAnimating={status === 'streaming'}
            >
                {content}
            </Streamdown>
        </div>
    );
}

