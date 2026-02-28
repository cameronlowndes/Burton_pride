import UpdateClient from "../components/Client/UpdateClient";

export const metadata = {
  title: "Burton Pride - Update",
  description: "Stay up-to-date with Burton Pride announcements and news.",
  keywords: "Burton Pride, updates, announcements, news, LGBTQ+ events",
};

// Server component handles metadata and can add server-side logic if needed
export default function UpdatePage() {
  return <UpdateClient />;
}
