import { redirect } from "next/navigation";
import MetaHead from "../components/MetaHead";
import CollaborateClient from "../components/Client/CollaborateClient";

export const metadata = {
  title: "Burton Pride - Collaborate with Us",
  description:
    "Looking to collaborate with Burton Pride? Submit your proposal and let's create something amazing together!",
  keywords:
    "Burton Pride, collaborate with Burton Pride, partnership proposal, collaborate with LGBTQ+, collaboration opportunities, business partnerships",
};

export default function Collaborate() {
  // 🚨 Redirect happens immediately, before rendering


  // ⚡ Old content is kept safe but won’t render
  return (
    <>
      <MetaHead
        title={metadata.title}
        description={metadata.description}
        keywords={metadata.keywords}
      />
      <CollaborateClient />
    </>
  );
}
