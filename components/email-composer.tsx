"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Send,
  Trash2,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

interface EmailComposerProps {
  to: string;
  subject: string;
  body: string;
  onSend?: () => void;
  onDiscard?: () => void;
}

export default function EmailComposer({
  to,
  subject: initialSubject,
  body,
  onSend,
  onDiscard,
}: EmailComposerProps) {
  const [subject, setSubject] = useState(initialSubject);
  const editorRef = useRef<HTMLDivElement>(null);
  const [, forceRender] = useState(0);

  // Set initial content
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = body;
    }
  }, [body]);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    forceRender((n) => n + 1);
  }, []);

  const isActive = useCallback((command: string) => {
    return document.queryCommandState(command);
  }, []);

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header fields — Gmail style */}
      <div className="px-4 pt-4 space-y-0">
        <div className="flex items-center gap-2 py-2 border-b border-border/50">
          <span className="text-sm text-muted-foreground w-16 shrink-0">To:</span>
          <span className="text-sm">{to}</span>
        </div>
        <div className="flex items-center gap-2 py-2 border-b border-border/50">
          <span className="text-sm text-muted-foreground w-16 shrink-0">Subject:</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-0 shadow-none p-0 h-auto text-sm focus-visible:ring-0"
            placeholder="Subject"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border/50">
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
          className={isActive("bold") ? "bg-muted" : ""}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
          className={isActive("italic") ? "bg-muted" : ""}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); addLink(); }}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); exec("undo"); }}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => { e.preventDefault(); exec("redo"); }}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor body — contentEditable */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="prose prose-sm dark:prose-invert max-w-none min-h-[300px] px-4 py-3 focus:outline-none text-sm"
          onInput={() => forceRender((n) => n + 1)}
        />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50">
        <Button onClick={onSend} size="sm">
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          <Trash2 className="h-4 w-4 mr-2" />
          Discard
        </Button>
      </div>
    </div>
  );
}
