const Watermark = () => {
  return (
    <a
      href="https://www.camerondigitalworks.com" // Replace with your real URL
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 text-xs sm:text-sm text-white bg-black bg-opacity-40 px-3 py-1 rounded-md shadow-md z-50 hover:bg-opacity-60 transition"
    >
      Built and powered by <span className="font-semibold">Cameron Digital Works</span>
    </a>
  );
};

export default Watermark;
