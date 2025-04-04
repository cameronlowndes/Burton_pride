import Link from 'next/link';

export default function Footer() {
    const currentYear = new Date().getFullYear(); // Get the current year

    return (
      <footer className="w-full bg-white text-black shadow-md py-4 px-8 flex justify-center items-center fixed bottom-0 left-0 right-0">
        <p className="text-sm text-center">
          &copy; {currentYear} Burton Pride | CIC No: 15490242 | Follow us on{" "}
          <a href="https://www.facebook.com/profile.php?id=61554367088734" className="underline">
            Facebook
          </a>{" "} |{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "} |{" "}
          <a 
            href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline text-pink-600 font-semibold"
          >
            Donate
          </a>
        </p>
      </footer>
    );
}
