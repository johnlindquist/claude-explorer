"use client";

import { useEffect, useState } from "react";
import { Project } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load projects");
        return res.json();
      })
      .then(data => {
        setProjects(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleProjectSelect = (project: Project) => {
    router.push(`/project/${encodeURIComponent(project.id)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="p-4 text-center text-muted-foreground">
            Loading projects...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="p-4 text-center text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Conversation Visualizer</h1>
        
        {projects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No projects found in ~/.claude/projects
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Select a Project</h2>
            <div className="grid gap-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project)}
                  className="text-left p-4 rounded-lg border transition-all hover:shadow-md hover:border-primary/50 bg-card border-border"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{project.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {project.conversationCount || 0} conversations
                      </p>
                    </div>
                    {project.lastModified && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(project.lastModified).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}