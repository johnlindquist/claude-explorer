"use client";

import { useEffect, useState } from "react";
import { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProjectSelectorProps {
  onProjectSelect: (project: Project) => void;
  selectedProjectId?: string;
}

export default function ProjectSelector({ onProjectSelect, selectedProjectId }: ProjectSelectorProps) {
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

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading projects...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No projects found in ~/.claude/projects
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold mb-4">Select a Project</h2>
      <div className="grid gap-3">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onProjectSelect(project)}
            className={cn(
              "text-left p-4 rounded-lg border transition-all",
              "hover:shadow-md hover:border-primary/50",
              selectedProjectId === project.id
                ? "bg-primary/10 border-primary"
                : "bg-card border-border"
            )}
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
    </div>
  );
}