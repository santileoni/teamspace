"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UpgradeDialog } from "@/app/upgrade-modal";

type CreateProjectFormProps = {
  userId: string;
  canUpgrade: boolean;
  disabled?: boolean;
};

export function CreateProjectForm({ userId, canUpgrade, disabled = false }: CreateProjectFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({ name })
    });
    const payload = (await response.json()) as { error?: string };

    setIsSubmitting(false);

    if (response.status === 403) {
      setShowUpgrade(true);
      return;
    }

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to create project.");
      return;
    }

    setName("");
    setMessage("Project created.");
    router.refresh();
  }

  return (
    <form className="create-project" onSubmit={onSubmit}>
      <div>
        <p className="form-title">New project</p>
        <label htmlFor="project-name">Name</label>
        <input
          id="project-name"
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Q3 launch"
          type="text"
          value={name}
          disabled={disabled}
        />
      </div>
      <button disabled={isSubmitting || disabled} type="submit">
        {isSubmitting ? "Creating..." : "Create"}
      </button>
      {disabled ? (
        <button type="button" className="upgrade-cta" onClick={() => setShowUpgrade(true)}>
          Upgrade a PRO
        </button>
      ) : null}
      {message ? <p className="form-message">{message}</p> : null}
      <UpgradeDialog
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        canUpgrade={canUpgrade}
        userId={userId}
      />
    </form>
  );
}
