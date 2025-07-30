import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ConversationEntry, ConversationMessage, ConversationSummary } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = path.join(process.cwd(), "conversations", `${params.id}.jsonl`);
    
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    
    let summary: ConversationSummary | null = null;
    const messages: ConversationMessage[] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const entry: ConversationEntry = JSON.parse(line);
        if (entry.type === "summary") {
          summary = entry;
        } else {
          messages.push(entry);
        }
      }
    }
    
    return NextResponse.json({
      id: params.id,
      summary: summary || { type: "summary", summary: "No summary available", leafUuid: "" },
      messages,
      lastUpdated: messages[messages.length - 1]?.timestamp || "",
      messageCount: messages.length
    });
  } catch (error) {
    console.error("Error reading conversation:", error);
    return NextResponse.json({ error: "Failed to read conversation" }, { status: 500 });
  }
}