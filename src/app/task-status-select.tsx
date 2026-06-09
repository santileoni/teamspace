"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type TaskStatusSelectProps = {
  status: TaskStatus;
  taskId: string;
  userId: string;
};

const statusLabels: Record<TaskStatus, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In progress",
  DONE: "Done"
};

export function TaskStatusSelect({ status, taskId, userId }: TaskStatusSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState<TaskStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValue(status);
  }, [status]);

  async function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as TaskStatus;

    setValue(nextStatus);
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({
        taskId,
        status: nextStatus
      })
    });
    const payload = (await response.json()) as { error?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setValue(status);
      setError(payload.error ?? "Unable to update task.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="task-status-control">
      <select
        aria-label="Task status"
        disabled={isSubmitting}
        onChange={onChange}
        value={value}
      >
        {Object.entries(statusLabels).map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
      {error ? <p>{error}</p> : null}
    </div>
  );
}
