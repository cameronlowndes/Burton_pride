import React, { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-sm text-center text-black">
      <h3 className="text-2xl font-semibold mb-4">{title}</h3>
      <div className="text-lg">{children}</div>
    </div>
  );
};

export default Card;
