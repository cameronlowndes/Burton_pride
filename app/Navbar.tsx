// components/Navbar.tsx
export default function Navbar() {
  return (
    <nav className="w-full bg-white text-black shadow-md py-4 px-8 flex justify-between items-center fixed top-0 left-0 right-0">
      <a href="/" className="text-xl font-bold text-pink-600">
        Burton Pride
      </a>
      <div className="flex gap-6">
        <a href="/" className="hover:underline">Home</a>
        <a href="/about" className="hover:underline">About</a>
        <a href="/events" className="hover:underline">Events</a>
      </div>
    </nav>
  );
}
