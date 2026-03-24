import { auth, clerkClient } from "@clerk/nextjs/server";

const MAIN_ADMIN_EMAILS = ["cameronlowndes@burtonpride.co.uk"];

export async function requireMainAdmin() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);

  const primaryEmail =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    )?.emailAddress || "";

  const isMainAdmin = MAIN_ADMIN_EMAILS.includes(primaryEmail.toLowerCase());

  if (!isMainAdmin) {
    throw new Error("Main admin access required");
  }

  return {
    userId,
    email: primaryEmail,
  };
}