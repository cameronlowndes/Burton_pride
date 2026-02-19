"use client";

const Watermark = () => {
  return (
    <a
      href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
      target="_blank"
      rel="noopener noreferrer"
      className="
        fixed
        bottom-3 right-3
        z-50
        rounded-lg
        bg-black/80
        backdrop-blur-sm
        text-white
        font-bold
        text-xs sm:text-sm lg:text-base
        px-2.5 sm:px-3.5
        py-1.5 sm:py-2
        shadow-md
        hover:shadow-xl
        hover:bg-black
        transition
        max-w-[85%]
        break-words
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

