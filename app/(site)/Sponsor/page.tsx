import MetaHead from "../components/MetaHead"; // Adjust path as needed
import SponsorsContent from "../../../SponsorsContent";

export const metadata = {
  title: "Burton Pride - Sponsors",
  description: "Learn how you can be a part of Burton Pride by volunteering, donating, or collaborating.",
};

export default function Sponsors() {
  return (
    <>
      <MetaHead
        title={metadata.title}
        description="Meet the amazing sponsors who support Burton Pride and help make our events possible."
        keywords="Burton Pride, sponsors, LGBTQ+ support, diversity, inclusion, events"
      />
      <SponsorsContent />
    </>
  );
}
