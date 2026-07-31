"use client";

const Watermark = () => {
  return (
    <div
      className="
        fixed
        bottom-3 right-3
        z-50
        rounded-lg
        bg-black/80
        backdrop-blur-sm
        text-white
        font-bold
        text-xs sm:text-sm
        px-3
        py-2
        shadow-md
        max-w-[85%]
        break-words
      "
    >
      <div className="text-yellow-300">
        The Money Management is in BETA 
      </div>

      <div className="mt-1 text-[10px] font-medium text-white/90 sm:text-xs">
        This mean They Could be Some Bugs or Issues, Please Report Any Issues to the Development Team.
      </div>
    </div>
  );
};

export default Watermark;