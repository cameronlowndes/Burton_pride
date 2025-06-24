import MetaHead from "../../components/MetaHead";
import JoinUsVolunteerContent from "../../components/Client/VolunteerRooting/JoinUsVolunteerContent"; // Client component import

export const metadata = {
  title: "Burton Pride - Volunteer",
  description: "Learn more about Burton Pride, our mission, and how to get involved.",
};

export default function VolunteerPage() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Volunteer"
        description="Join us to make a difference! Volunteer with Burton Pride and help us create an inclusive and vibrant community."
      />
      <JoinUsVolunteerContent />
    </>
  );
}
