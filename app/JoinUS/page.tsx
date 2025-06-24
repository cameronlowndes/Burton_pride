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

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-32">
        <header className="text-center flex flex-col items-center gap-6 mt-16 w-full">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="hero-logo"
          />
          <h1 className="text-4xl sm:text-6xl font-bold">Join Us at Burton Pride</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            Whether you're looking to volunteer, donate, or collaborate, there are plenty of ways to support and get involved with Burton Pride.
          </p>
        </header>

        {/* Client component imported normally */}
        <JoinUsContent />
      </div>
    </>
  );
}
