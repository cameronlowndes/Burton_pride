"use client";

const Watermark = () => {
  return (
    <a
      href="https://www.camerondigitalworks.com"
      target="_blank"
      rel="noopener noreferrer"
      className="
        fixed
        bottom-4 right-4
        rounded-lg
        bg-black
        text-white
        text-sm sm:text-base
        font-bold
        px-4 py-2
        z-50
        shadow-lg
        hover:shadow-2xl
        hover:bg-gray-900
        transition
      "
    >
      🚀 Built & Powered by{" "}
      <span className="uppercase text-yellow-300">
        Cameron Digital Works
      </span>
    </a>
  );
};

export default Watermark;
