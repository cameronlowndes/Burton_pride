const Watermark = () => {
  return (
    <a
      href="https://www.camerondigitalworks.com"
      target="_blank"
      rel="noopener noreferrer"
      className="
        fixed 
        bottom-0 left-0 right-0
        sm:bottom-4 sm:left-auto sm:right-4 sm:w-auto sm:rounded-md
        text-center sm:text-left
        text-xs sm:text-sm 
        text-white 
        bg-black bg-opacity-50 
        px-3 py-2 
        z-50 
        shadow-md 
        hover:bg-opacity-70 
        transition
      "
      style={{ pointerEvents: 'auto' }}
    >
      Built and powered by <span className="font-semibold">Cameron Digital Works</span>
    </a>
  );
};

export default Watermark;
