import Image from "next/image";
import Link from "next/link";

// SponsorCard component
type SponsorCardProps = {
  imageSrc: string;
  altText: string;
  name: string;
  description: string;
  link: string;
};

const sponsors: SponsorCardProps[] = [
  {
    imageSrc: "/image/SocialRoots&GreenShootsPrideLogo.jpg",
    altText: "Social Roots & Green Shoots",
    name: "Social Roots & Green Shoots",
    description: "Committed to supporting LGBTQ+ communities.",
    link: "https://www.youtube.com/@SocialRootsGreenShoots",
  },
  {
    imageSrc: "/image/B&Q_LGBTQ_logo.jpeg",
    altText: "B&Q",
    name: "B&Q",
    description: "Committed to supporting LGBTQ+ communities.",
    link: "https://www.diy.com",
  },
  {
    imageSrc: "/image/taskTidy.jpg",
    altText: "Task Tidy",
    name: "Task Tidy",
    description: "Committed to supporting LGBTQ+ communities.",
    link: "https://www.tasktidy.co.uk",
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
          <Image
            src={sponsor.imageSrc}
            alt={sponsor.altText}
            width={sponsor.name === "Task Tidy" ? 200 : 150}
            height={sponsor.name === "Task Tidy" ? 200 : 150}
            className={`rounded mb-4 ${
              sponsor.name === "Task Tidy" ? "w-48 h-48" : "w-32 h-32"
            }`}
          />
          <h2 className="text-xl font-semibold">{sponsor.name}</h2>
          <p className="text-gray-600 text-center mb-4">{sponsor.description}</p>
          <Link
            href={sponsor.link}
            target="_blank"
            className="bg-pink-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-pink-700 transition"
          >
            Visit Sponsor
          </Link>
        </div>
      ))}
    </div>
  );
}


