"use client";

import { useEffect, useState } from "react";
import { Conversation } from "@/lib/types";
import Link from "next/link";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then(res => res.json())
      .then(data => {
        setConversations(data);
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load conversations");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-100 mb-8">Loading conversations...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-red-400 mb-8">{error}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">Conversations</h1>
        
        <div className="grid gap-4">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/conversation/${conv.id}`}
              className="bg-gray-800 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-750 transition-all p-6 block border border-gray-700"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold text-gray-100 flex-1">
                  {conv.summary.summary}
                </h2>
                <span className="text-sm text-gray-400 ml-4">
                  {conv.messageCount} messages
                </span>
              </div>
              
              <div className="text-sm text-gray-500">
                <p>ID: {conv.id.substring(0, 8)}...</p>
                <p>Last updated: {new Date(conv.lastUpdated).toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
        
        {conversations.length === 0 && (
          <p className="text-gray-400 text-center py-8">No conversations found</p>
        )}
      </div>
    </div>
  );
}