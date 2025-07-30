import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Conversation, ConversationEntry, ConversationMessage, ConversationSummary } from "@/lib/types";

export async function GET() {
  try {
    const conversationsDir = path.join(process.cwd(), "conversations");
    const files = await fs.readdir(conversationsDir);
    const jsonlFiles = files.filter(file => file.endsWith(".jsonl"));
    
    const conversations: Conversation[] = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(conversationsDir, file);
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
        
        const lastMessage = messages[messages.length - 1];
        
        return {
          id: file.replace(".jsonl", ""),
          summary: summary || { type: "summary", summary: "No summary available", leafUuid: "" },
          messages,
          lastUpdated: lastMessage?.timestamp || "",
          messageCount: messages.length
        };
      })
    );
    
    // Sort by last updated, most recent first
    conversations.sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    
    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error reading conversations:", error);
    return NextResponse.json({ error: "Failed to read conversations" }, { status: 500 });
  }
}