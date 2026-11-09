import type { Metadata } from "next";
import ModerationNotificationSettings from "../../components/SocialMediaModeration/client/ModerationNotificationSettings";

export const metadata: Metadata = {
  title: "Moderation Notifications",
  robots: { index: false, follow: false },
};

export default function ModerationNotificationsPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-sm font-semibold text-purple-200">Social Media Moderation</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Notifications</h1>
      <p className="mt-2 max-w-2xl text-slate-300">
        Choose when moderation alerts reach your phone. You can review your cases in the shared inbox at any time.
      </p>
      <div className="mt-6">
        <ModerationNotificationSettings />
      </div>
    </section>
  );
}
