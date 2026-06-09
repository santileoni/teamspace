import { DEFAULT_USER_ID, requireCurrentUser } from "@/lib/current-user";
import { getPlanUsageForUser, listProjectsForUser } from "@/lib/projects";
import { AddTaskForm } from "@/app/add-task-form";
import { CreateProjectForm } from "@/app/create-project-form";
import { PlanUsageBanner } from "@/app/plan-usage-banner";
import { ProjectStatusActions } from "@/app/project-status-actions";
import { TaskStatusSelect } from "@/app/task-status-select";

type HomeProps = {
  searchParams?: Promise<{
    projectId?: string;
    userId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const userId = params?.userId ?? DEFAULT_USER_ID;
  const [currentUser, projects, usage] = await Promise.all([
    requireCurrentUser(userId),
    listProjectsForUser(userId),
    getPlanUsageForUser(userId)
  ]);
  const canUpgrade = currentUser.role === "ADMIN";
  const accessibleProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const ownProjects = projects.filter(
    (project) => project.organizationId === currentUser.organizationId
  );
  const ownAccessibleProjects = ownProjects.filter((project) => project.status !== "ARCHIVED");
  const requestedProject = projects.find((project) => project.id === params?.projectId);
  const selectedProject =
    requestedProject ??
    ownAccessibleProjects[0] ??
    ownProjects[0] ??
    accessibleProjects[0] ??
    projects[0];
  const selectedProjectIsArchived = selectedProject?.status === "ARCHIVED";

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Workspace</p>
          <div className="workspace-name-row">
            <h1>{currentUser.organization.name}</h1>
            <span className="plan-pill">
              <span>Plan</span>
              <strong>{currentUser.organization.plan.toLowerCase()}</strong>
            </span>
          </div>
          <p className="subtle">Signed in as {currentUser.name}</p>
        </div>
        <nav className="workspace-switcher" aria-label="Switch workspace">
          <span className="switcher-label">Switch workspace</span>
          <div className="switcher-options">
            <a className={userId === "user-ana" ? "active" : ""} href="/?userId=user-ana">
              <strong>Nimbus Labs</strong>
              <span>Ana</span>
            </a>
            <a className={userId === "user-ben" ? "active" : ""} href="/?userId=user-ben">
              <strong>Cobalt Studio</strong>
              <span>Ben</span>
            </a>
          </div>
        </nav>
      </section>

      <div className="workspace-layout">
        <section className="project-sidebar" aria-label="Projects">
          <div className="project-sidebar-header">
            <div>
              <p className="eyebrow">Projects</p>
              <h2>{projects.length} total</h2>
            </div>
            <span className="subtle">{accessibleProjects.length} open</span>
          </div>

          {usage.atLimit && usage.limit !== null ? (
            <PlanUsageBanner
              activeProjects={usage.activeProjects}
              limit={usage.limit}
              canUpgrade={canUpgrade}
              userId={userId}
            />
          ) : null}

          <CreateProjectForm
            userId={userId}
            canUpgrade={canUpgrade}
            disabled={usage.atLimit}
          />

          <ul className="project-stack">
            {projects.map((project) => (
              <li
                className={`project-item ${
                  project.id === selectedProject?.id ? "selected-project" : ""
                } ${project.status === "ARCHIVED" ? "archived-project" : ""}`}
                key={project.id}
              >
                <div className="project-item-main">
                  <a
                    className={`project-link ${
                      project.status === "ARCHIVED" ? "project-name-muted" : ""
                    }`}
                    href={`/?userId=${userId}&projectId=${project.id}`}
                  >
                    {project.name}
                  </a>
                  <p className="project-meta">
                    {project.status === "ARCHIVED"
                      ? "Unavailable"
                      : project.tasks.length === 1
                        ? "1 task"
                        : `${project.tasks.length} tasks`}
                  </p>
                </div>

                <span className={`status status-${project.status.toLowerCase()}`}>
                  {project.status.toLowerCase()}
                </span>
                <ProjectStatusActions
                  projectId={project.id}
                  status={project.status}
                  userId={userId}
                  canUpgrade={canUpgrade}
                />
              </li>
            ))}
          </ul>
        </section>

        {selectedProject ? (
          <section className="task-panel" aria-label="Project details">
            <div className="task-panel-header">
              <div>
                <p className="eyebrow">
                  {selectedProjectIsArchived ? "Archived project" : "Tasks"}
                </p>
                <h2>{selectedProject.name}</h2>
                <p className="subtle">
                  {selectedProjectIsArchived
                    ? "Unavailable"
                    : selectedProject.tasks.length === 1
                    ? "1 task in this project"
                    : `${selectedProject.tasks.length} tasks in this project`}
                </p>
              </div>
              <div className="project-detail-actions">
                <span className={`status status-${selectedProject.status.toLowerCase()}`}>
                  {selectedProject.status.toLowerCase()}
                </span>
              </div>
            </div>

            {selectedProjectIsArchived ? (
              <p className="empty-state">Project archived.</p>
            ) : (
              <>
                <AddTaskForm projectId={selectedProject.id} userId={userId} />

                {selectedProject.tasks.length > 0 ? (
                  <ul className="task-list task-list-large">
                    {selectedProject.tasks.map((task) => (
                      <li key={task.id}>
                        <span className={`task-status task-${task.status.toLowerCase()}`} />
                        <span>{task.title}</span>
                        <TaskStatusSelect status={task.status} taskId={task.id} userId={userId} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state">No tasks yet.</p>
                )}
              </>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
