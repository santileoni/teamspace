import "dotenv/config";
import { and, inArray, notInArray } from "drizzle-orm";
import { closeDb, db } from "./client";
import {
  BillingPlan,
  organizations as organizationTable,
  ProjectStatus,
  projects as projectTable,
  TaskStatus,
  tasks as taskTable,
  UserRole,
  users as userTable
} from "./schema";

const deletedAt = new Date("2026-01-15T00:00:00.000Z");

const organizations = [
  {
    id: "org-nimbus",
    name: "Nimbus Labs",
    slug: "nimbus",
    plan: BillingPlan.FREE,
    users: [
      {
        id: "user-ana",
        email: "ana@nimbus.example",
        name: "Ana Nimbus",
        role: UserRole.ADMIN
      }
    ],
    projects: [
      {
        id: "project-nimbus-roadmap",
        name: "Roadmap",
        status: ProjectStatus.ACTIVE,
        tasks: [
          {
            id: "task-nimbus-roadmap-pricing",
            title: "Draft pricing milestone",
            status: TaskStatus.IN_PROGRESS
          },
          {
            id: "task-nimbus-roadmap-beta",
            title: "Confirm beta checklist",
            status: TaskStatus.TODO
          },
          {
            id: "task-nimbus-roadmap-old",
            title: "Remove stale launch note",
            status: TaskStatus.DONE,
            deletedAt
          }
        ]
      },
      {
        id: "project-nimbus-billing",
        name: "Billing Cleanup",
        status: ProjectStatus.ACTIVE,
        tasks: [
          {
            id: "task-nimbus-billing-invoices",
            title: "Review invoice states",
            status: TaskStatus.TODO
          },
          {
            id: "task-nimbus-billing-copy",
            title: "Rewrite payment failure copy",
            status: TaskStatus.DONE
          }
        ]
      },
      {
        id: "project-nimbus-archive",
        name: "Legacy Migration",
        status: ProjectStatus.ARCHIVED,
        tasks: [
          {
            id: "task-nimbus-archive-export",
            title: "Export legacy CSVs",
            status: TaskStatus.DONE
          }
        ]
      },
      {
        id: "project-nimbus-deleted",
        name: "Retired Analytics",
        status: ProjectStatus.ACTIVE,
        deletedAt,
        tasks: [
          {
            id: "task-nimbus-deleted-notes",
            title: "Close old dashboard notes",
            status: TaskStatus.DONE
          }
        ]
      }
    ]
  },
  {
    id: "org-cobalt",
    name: "Cobalt Studio",
    slug: "cobalt",
    plan: BillingPlan.PRO,
    users: [
      {
        id: "user-ben",
        email: "ben@cobalt.example",
        name: "Ben Cobalt",
        role: UserRole.MEMBER
      }
    ],
    projects: [
      {
        id: "project-cobalt-launch",
        name: "Launch Plan",
        status: ProjectStatus.ACTIVE,
        tasks: [
          {
            id: "task-cobalt-launch-brief",
            title: "Finalize launch brief",
            status: TaskStatus.IN_PROGRESS
          },
          {
            id: "task-cobalt-launch-assets",
            title: "Approve social assets",
            status: TaskStatus.TODO
          }
        ]
      },
      {
        id: "project-cobalt-research",
        name: "Research Pipeline",
        status: ProjectStatus.ACTIVE,
        tasks: [
          {
            id: "task-cobalt-research-calls",
            title: "Schedule customer calls",
            status: TaskStatus.TODO
          },
          {
            id: "task-cobalt-research-synthesis",
            title: "Summarize findings",
            status: TaskStatus.DONE
          }
        ]
      }
    ]
  }
];

async function main() {
  const now = new Date();
  const organizationIds = organizations.map((organization) => organization.id);
  const userIds = organizations.flatMap((organization) =>
    organization.users.map((user) => user.id)
  );
  const projectIds = organizations.flatMap((organization) =>
    organization.projects.map((project) => project.id)
  );
  const taskIds = organizations.flatMap((organization) =>
    organization.projects.flatMap((project) => project.tasks.map((task) => task.id))
  );

  await db
    .delete(taskTable)
    .where(and(inArray(taskTable.projectId, projectIds), notInArray(taskTable.id, taskIds)));

  await db
    .delete(projectTable)
    .where(
      and(
        inArray(projectTable.organizationId, organizationIds),
        notInArray(projectTable.id, projectIds)
      )
    );

  await db
    .delete(userTable)
    .where(and(inArray(userTable.organizationId, organizationIds), notInArray(userTable.id, userIds)));

  for (const organization of organizations) {
    await db
      .insert(organizationTable)
      .values({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: organizationTable.id,
        set: {
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          updatedAt: now
        }
      });

    for (const user of organization.users) {
      await db
        .insert(userTable)
        .values({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: organization.id,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: userTable.id,
          set: {
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: organization.id,
            updatedAt: now
          }
        });
    }

    for (const project of organization.projects) {
      await db
        .insert(projectTable)
        .values({
          id: project.id,
          name: project.name,
          status: project.status,
          organizationId: organization.id,
          deletedAt: nullableDeletedAt(project),
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: projectTable.id,
          set: {
            name: project.name,
            status: project.status,
            organizationId: organization.id,
            deletedAt: nullableDeletedAt(project),
            updatedAt: now
          }
        });

      for (const task of project.tasks) {
        await db
          .insert(taskTable)
          .values({
            id: task.id,
            title: task.title,
            status: task.status,
            projectId: project.id,
            deletedAt: nullableDeletedAt(task),
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: taskTable.id,
            set: {
              title: task.title,
              status: task.status,
              projectId: project.id,
              deletedAt: nullableDeletedAt(task),
              updatedAt: now
            }
          });
      }
    }
  }
}

function nullableDeletedAt(record: object) {
  if ("deletedAt" in record && record.deletedAt instanceof Date) {
    return record.deletedAt;
  }

  return null;
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
