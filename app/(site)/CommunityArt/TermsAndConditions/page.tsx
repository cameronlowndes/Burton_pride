import type { Metadata } from "next";
import CommunityArtTermsContent from "../../components/Client/CommunityArtTermsContent";

export const metadata: Metadata = {
  title: "Community Art Terms and Conditions | Burton Pride",
  description:
    "Read the Burton Pride Community Art Terms and Conditions, including artist ownership, privacy, permissions and the no-AI artwork policy.",
};

export default function CommunityArtTermsPage() {
  return <CommunityArtTermsContent />;
}
