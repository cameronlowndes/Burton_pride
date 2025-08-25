import React, { ReactNode } from "react";
import clsx from "clsx"; 

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className }) => {
  return (
    <div
      className={clsx(
        "bg-white shadow-lg rounded-2xl p-6 w-full max-w-sm text-center text-black",
        className 
      )}
    >
      <h3 className="text-2xl font-semibold mb-4">{title}</h3>
      <div className="text-lg">{children}</div>
    </div>
  );
};

export default Card;
