
import Image from 'next/image';
import MetaHead from '../components/MetaHead';
import JoinUsContent from '../components/Client/VolunteerRooting/JoinUsContent';

export const metadata = {
  title: "Burton Pride - Join Us",
  description: "Learn how you can be a part of Burton Pride by volunteering, donating, or collaborating.",
};

export default function JoinUs() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Join Us"
        description="Learn how you can be a part of Burton Pride by volunteering, donating, or collaborating. Join us in creating a more inclusive and diverse community."
        keywords="Burton Pride, volunteer, donate, collaborate, LGBTQ+ community, get involved"
      />

      {/* Page Container */}
      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">

        {/* Client Component */}
        <JoinUsContent />
      </div>
    </>
  );
}
