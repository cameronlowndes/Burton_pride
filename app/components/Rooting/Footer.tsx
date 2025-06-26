import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white text-black shadow-md py-2 px-6 flex flex-col items-center fixed bottom-0 left-0 right-0">
      <div className="w-full max-w-6xl flex flex-col justify-center items-center">
        <div className="text-xs text-center mb-2">
          <p>
            &copy; {currentYear} Burton Pride | CIC No: 15490242 | Follow us on{" "}
            <a href="https://www.facebook.com/profile.php?id=61556621159422" className="underline">
              Facebook
            </a>{" "}
            |{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            |{" "}
            <a
              href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-pink-600 font-semibold"
            >
              Donate
            </a>
          </p>
        </div>
        <div className="text-xs text-center text-gray-500">
          <a
            href="https://camerondigitalworks.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            Built and powered by Cameron Digital Works
          </a>
        </div>
      </div>
    </footer>
  );
}
