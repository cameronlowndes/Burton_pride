'use client';
import Link from 'next/link';
import React from 'react';

interface Product {
  id: string;
  title: string;
  handle: string;
  imageUrl: string;
  imageAlt: string;
  price: string;
}

interface ShopClientProps {
  products: Product[];
}

export default function ShopClient({ products }: ShopClientProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 p-4">
      {products.map((product) => (
        <div
          key={product.id}
          className="relative bg-white/5 backdrop-blur-lg border border-white/20 rounded-xl shadow-lg overflow-hidden transform transition-all duration-500 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(255,255,255,0.15)]"
        >
          {/* Image Section */}
          <div className="relative w-full h-40 sm:h-48">
            <img
              src={product.imageUrl}
              alt={product.imageAlt}
              className="w-full h-full object-cover rounded-t-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-t-xl"></div>
          </div>

          {/* Text & Link Section */}
          <div className="p-6 text-center">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{product.title}</h2>
            <p className="text-lg text-yellow-300 font-semibold mb-4">£{product.price}</p>
            <Link
              href="/Shop/BurtonPrideUnisexTop"
              className="inline-block bg-yellow-400 text-purple-900 font-bold px-6 py-3 rounded-full shadow-lg hover:shadow-2xl hover:bg-yellow-500 transition-all duration-300"
            >
              View Product
            </Link>
          </div>

          {/* Overlay pulse effect */}
          <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none animate-pulse"></div>
        </div>
      ))}
    </div>
  );
}
