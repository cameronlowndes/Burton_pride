export default function Footer() {
    const currentYear = new Date().getFullYear(); // Get the current year
  
    return (
      <footer className="w-full bg-white text-black shadow-md py-4 px-8 flex justify-center items-center fixed bottom-0 left-0 right-0">
        <p className="text-sm text-center">
          &copy; {currentYear} Burton Pride | CIC No: 15490242 | Follow us on{" "}
          <a href="https://www.facebook.com/profile.php?id=61554367088734" className="underline">
            Facebook
          </a>
        </p>
      </footer>
    );
  }
  