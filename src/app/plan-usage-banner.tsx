"use client";

import { useState } from "react";
import { UpgradeDialog } from "@/app/upgrade-modal";

type PlanUsageBannerProps = {
  activeProjects: number;
  limit: number;
  canUpgrade: boolean;
  userId: string;
};

export function PlanUsageBanner({
  activeProjects,
  limit,
  canUpgrade,
  userId
}: PlanUsageBannerProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="plan-banner">
      <div className="plan-banner-text">
        <strong>
          {activeProjects} de {limit} proyectos usados
        </strong>
        <p className="subtle">Plan FREE</p>
      </div>
      <button type="button" className="upgrade-cta" onClick={() => setShowUpgrade(true)}>
        Upgrade a PRO
      </button>
      <UpgradeDialog
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        canUpgrade={canUpgrade}
        userId={userId}
      />
    </div>
  );
}
