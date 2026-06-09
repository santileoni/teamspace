import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export const DEFAULT_USER_ID = "user-ana";

export async function requireCurrentUser(userId = DEFAULT_USER_ID) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      organization: true
    }
  });

  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }

  return user;
}
