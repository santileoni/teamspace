"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AddTaskFormProps = {
  projectId: string;
  userId: string;
};

export function AddTaskForm({ projectId, userId }: AddTaskFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({
        projectId,
        title
      })
    });
    const payload = (await response.json()) as { error?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to create task.");
      return;
    }

    setTitle("");
    router.refresh();
  }

  return (
    <form className="add-task" onSubmit={onSubmit}>
      <div>
        <label htmlFor="task-title">Task</label>
        <input
          id="task-title"
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Follow up with design"
          type="text"
          value={title}
        />
      </div>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Adding..." : "Add"}
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
