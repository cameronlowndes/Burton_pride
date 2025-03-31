import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full bg-white text-black shadow-md py-4 px-8 flex justify-between items-center fixed top-0 left-0 right-0">
      <Link href="/">
        <span className="text-xl font-bold text-pink-600">Burton Pride</span>
      </Link>
      <div className="flex gap-6">
        <Link href="#events" className="hover:text-pink-600 transition">Events</Link>
        <Link href="#about" className="hover:text-pink-600 transition">About</Link>
        <Link href="#contact" className="hover:text-pink-600 transition">Contact</Link>
      </div>
    </nav>
  );
}
