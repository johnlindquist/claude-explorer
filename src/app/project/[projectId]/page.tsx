"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Conversation, Project } from "@/lib/types";
import Link from "next/link";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.projectId) {
      // First load project info
      fetch("/api/projects")
        .then(res => res.json())
        .then((projects: Project[]) => {
          const proj = projects.find(p => p.id === params.projectId);
          if (proj) {
            setProject(proj);
          }
        });

      // Then load conversations
      setLoading(true);
      fetch(`/api/projects/${params.projectId}/conversations`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load conversations");
          return res.json();
        })
        .then(data => {
          setConversations(data);
          setLoading(false);
        })
        .catch(err => {
          setError("Failed to load conversations");
          setLoading(false);
        });
    }
  }, [params.projectId]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Conversation Visualizer</h1>
            {project && (
              <>
                <h2 className="text-2xl font-semibold mt-2">{project.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {conversations.length} conversations
                </p>
              </>
            )}
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            ← Change Project
          </Link>
        </div>
        
        {loading && (
          <div className="text-center text-muted-foreground py-8">
            Loading conversations...
          </div>
        )}
        
        {error && (
          <div className="text-center text-destructive py-8">
            {error}
          </div>
        )}
        
        <div className="grid gap-4">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/project/${params.projectId}/conversation/${conv.id}`}
              className="bg-card rounded-lg shadow-sm hover:shadow-md transition-all p-6 block border"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold flex-1">
                  {conv.summary.summary}
                </h2>
                <span className="text-sm text-muted-foreground ml-4">
                  {conv.messageCount} messages
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>ID: {conv.id.substring(0, 8)}...</p>
                <p>Last updated: {new Date(conv.lastUpdated).toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
        
        {conversations.length === 0 && !loading && (
          <p className="text-muted-foreground text-center py-8">No conversations found in this project</p>
        )}
      </div>
    </div>
  );
}