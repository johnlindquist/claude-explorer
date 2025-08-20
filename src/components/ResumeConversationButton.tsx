"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  className?: string;
  label?: string;
}

/**
 * Button that copies: `claude --resume <sessionId>` to clipboard
 * - Stops navigation if rendered inside a <Link> card
 * - Shows a brief "Copied!" state to tell the user it worked
 */
export default function ResumeConversationButton({
  sessionId,
  className,
  label = "▶️ Resume Conversation",
}: Props) {
  const [copied, setCopied] = useState(false);
  const cmd = `claude --resume ${sessionId}`;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    // Prevent parent <Link> cards from navigating
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy resume command:", err);
      alert(`Copy failed. You can manually copy this:\n\n${cmd}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1",
        // default look (callers can override via className)
        "bg-primary text-primary-foreground hover:bg-primary/80",
        className
      )}
      title={`Copy "${cmd}" to clipboard`}
      aria-label={`Copy "${cmd}" to clipboard`}
    >
      {copied ? "✅ Copied: claude --resume ..." : label}
      {/* Tell screen readers what happened */}
      <span className="sr-only" aria-live="polite">
        {copied ? `Copied ${cmd} to clipboard. Paste in your terminal to resume.` : ""}
      </span>
    </button>
  );
}