"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UpgradeDialogProps = {
  open: boolean;
  onClose: () => void;
  canUpgrade: boolean;
  userId: string;
};

export function UpgradeDialog({ open, onClose, canUpgrade, userId }: UpgradeDialogProps) {
  const router = useRouter();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function upgrade() {
    setIsUpgrading(true);
    setError(null);

    const response = await fetch("/api/organization", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId
      },
      body: JSON.stringify({ plan: "PRO" })
    });
    const payload = (await response.json()) as { error?: string };

    setIsUpgrading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to upgrade.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="upgrade-overlay" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className="upgrade-modal">
        <p className="eyebrow">Plan FREE</p>
        <h2 id="upgrade-title">Llegaste al límite de proyectos</h2>

        {canUpgrade ? (
          <>
            <p>Upgradeá a PRO para crear proyectos ilimitados.</p>
            <div className="upgrade-actions">
              <button type="button" onClick={onClose} disabled={isUpgrading}>
                Cancelar
              </button>
              <button
                type="button"
                className="upgrade-cta"
                onClick={upgrade}
                disabled={isUpgrading}
              >
                {isUpgrading ? "Actualizando..." : "Upgrade a PRO"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Pedile a un admin de tu organización que haga el upgrade a PRO.</p>
            <div className="upgrade-actions">
              <button type="button" onClick={onClose}>
                Entendido
              </button>
            </div>
          </>
        )}

        {error ? <p className="form-message">{error}</p> : null}
      </div>
    </div>
  );
}
