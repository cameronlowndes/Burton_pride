import Image from "next/image";
import Link from "next/link";

// SponsorCard component
type SponsorCardProps = {
  imageSrc: string;
  altText: string;
  name: string;
  description: string;
  link?: string; // Optional link
};

const sponsors: SponsorCardProps[] = [
  {
    imageSrc: "/image/CompanyLogo/SocialRoots&GreenShootsPrideLogo.jpg",
    altText: "Social Roots & Green Shoots",
    name: "Social Roots & Green Shoots",
    description: "Committed to supporting LGBTQ+ communities.",
    link: "https://www.youtube.com/@SocialRootsGreenShoots",
  },

  {
    imageSrc: "/image/CompanyLogo/WincantonLogo.png",
    altText: "Wincanton",
    name: "Wincanton",
    description: "Proud to support Burton Pride.",
  },

  {
    imageSrc: "/image/CompanyLogo/DavidWilson.jpg",
    altText: "David Wilson Homes",
    name: "David Wilson Home",
    description: "Proud to support Burton Pride.",
    link: "https://www.dwh.co.uk",
  },

  {
    imageSrc: "/image/CompanyLogo/Central_Co-op_logo.png",
    altText: "Cntral England co-op",
    name: "Central  England Co-Op ",
    description: "Proud to support Burton Pride.",
    link: "https://www.centralcoop.co.uk",
  },

  {
    imageSrc: "/image/CompanyLogo/EastMidland.jpg",
    altText: "East Midlands Airport",
    name: "East Midlands Airport ",
    description: "Proud to support Burton Pride.",
     link: "https://www.eastmidlandsairport.com",
  },
];

export default function SponsorCard() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sponsors.map((sponsor, index) => (
        <div
          key={index}
          className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center transition hover:shadow-lg hover:scale-105"
        >
          <div className="w-40 h-32 mb-4 relative">
            <Image
              src={sponsor.imageSrc}
              alt={sponsor.altText}
              fill
              style={{ objectFit: "contain" }}
              className="rounded"
            />
          </div>
          <h2 className="text-xl font-semibold text-center">{sponsor.name}</h2>
          <p className="text-gray-600 text-center mb-4">
            {sponsor.description}
          </p>
          {sponsor.link && (
            <Link
              href={sponsor.link}
              target="_blank"
              className="bg-pink-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-pink-700 transition"
            >
              Visit Sponsor
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
