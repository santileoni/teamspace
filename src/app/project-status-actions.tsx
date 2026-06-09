"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProjectStatus = "ACTIVE" | "ARCHIVED";

type ProjectStatusActionsProps = {
  projectId: string;
  status: ProjectStatus;
  userId: string;
};

type PendingAction = ProjectStatus | "DELETE";

export function ProjectStatusActions({
  projectId,
  status,
  userId
}: ProjectStatusActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: ProjectStatus) {
    setPendingAction(nextStatus);
    setError(null);

    const response = await fetch("/api/projects", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({
        projectId,
        status: nextStatus
      })
    });
    const payload = (await response.json()) as { error?: string };

    setPendingAction(null);

    if (!response.ok) {
      setError(payload.error ?? "Unable to update project.");
      return;
    }

    router.refresh();
  }

  async function deleteProject() {
    if (!window.confirm("Permanently delete this project?")) {
      return;
    }

    setPendingAction("DELETE");
    setError(null);

    const response = await fetch("/api/projects", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({
        projectId
      })
    });
    const payload = (await response.json()) as { error?: string };

    setPendingAction(null);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete project.");
      return;
    }

    router.refresh();
  }

  const isPending = pendingAction !== null;

  return (
    <div className="status-actions">
      {status === "ARCHIVED" ? (
        <button
          disabled={isPending}
          onClick={() => updateStatus("ACTIVE")}
          type="button"
        >
          {pendingAction === "ACTIVE" ? "..." : "Unarchive"}
        </button>
      ) : null}
      {status !== "ARCHIVED" ? (
        <button
          disabled={isPending}
          onClick={() => updateStatus("ARCHIVED")}
          type="button"
        >
          {pendingAction === "ARCHIVED" ? "..." : "Archive"}
        </button>
      ) : null}
      <button
        className="danger-action"
        disabled={isPending}
        onClick={deleteProject}
        type="button"
      >
        {pendingAction === "DELETE" ? "..." : "Delete"}
      </button>
      {error ? <p>{error}</p> : null}
    </div>
  );
}
