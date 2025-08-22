'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductClient({ product }: any) {
  const router = useRouter();

  const colorOption = product.options.find((opt: any) => opt.name.toLowerCase() === 'color');
  const sizeOption = product.options.find((opt: any) => opt.name.toLowerCase() === 'size');
  const availableColors = colorOption ? colorOption.values : [];
  const availableSizes = sizeOption ? sizeOption.values : [];

  // Desired size order
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
  const sortedSizes = availableSizes.slice().sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.toUpperCase());
    const indexB = sizeOrder.indexOf(b.toUpperCase());
    return indexA - indexB;
  });

  const colorNameMap: Record<string, string> = {
    'Kelly': 'Green',
    'Kelly Green': 'Green',
    'Red': 'Red',
    'Blue': 'Blue',
    'Black': 'Black',
    'White': 'White',
  };

  const [selectedColor, setSelectedColor] = useState(availableColors[0] || '');
  const [selectedSize, setSelectedSize] = useState(sortedSizes[0] || '');
  const [displayImage, setDisplayImage] = useState(product.images.edges[0]?.node.url);
  const [displayAlt, setDisplayAlt] = useState(product.images.edges[0]?.node.altText);
  const [inStock, setInStock] = useState(true);

  const allImages = product.images.edges.map((img: any) => img.node.url);

  useEffect(() => {
    const normalize = (str: string) => str?.trim().toLowerCase() || '';

    // Find variant that matches both color & size
    let matchingVariant = product.variants.edges.find((v: any) => {
      const opts = v.node.selectedOptions;
      const colorMatch = opts.find((o: any) => o.name.toLowerCase() === 'color');
      const sizeMatch = opts.find((o: any) => o.name.toLowerCase() === 'size');
      return colorMatch && sizeMatch &&
             normalize(colorMatch.value) === normalize(selectedColor) &&
             normalize(sizeMatch.value) === normalize(selectedSize);
    });

    // Fallback: match size only
    if (!matchingVariant) {
      matchingVariant = product.variants.edges.find((v: any) => {
        const opts = v.node.selectedOptions;
        const sizeMatch = opts.find((o: any) => o.name.toLowerCase() === 'size');
        return sizeMatch && normalize(sizeMatch.value) === normalize(selectedSize);
      });
    }

    // Fallback: match color only
    if (!matchingVariant && selectedColor) {
      matchingVariant = product.variants.edges.find((v: any) => {
        const opts = v.node.selectedOptions;
        const colorMatch = opts.find((o: any) => o.name.toLowerCase() === 'color');
        return colorMatch && normalize(colorMatch.value) === normalize(selectedColor);
      });
    }

    // Update display image & alt
    setDisplayImage(matchingVariant?.node.image?.url || product.images.edges[0]?.node.url);
    setDisplayAlt(matchingVariant?.node.image?.altText || product.images.edges[0]?.node.altText);

    // Update stock status
    setInStock(matchingVariant ? matchingVariant.node.availableForSale : false);

  }, [selectedColor, selectedSize, product]);

  return (
    <main className="pt-28 pb-16 px-4 sm:px-6 min-h-screen bg-gradient-to-br flex justify-center items-start">
      <div className="w-full max-w-4xl bg-black/20 backdrop-blur-lg border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl transform transition-all duration-700 hover:scale-105 hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)]">

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center bg-white/20 text-white font-bold px-4 py-2 rounded-xl shadow hover:bg-white/30 transition-all duration-300 cursor-pointer"
        >
          ← Back
        </button>

        {/* Main Product Image */}
        <div className="relative w-full mb-4 rounded-2xl overflow-hidden shadow-inner">
          <img
            src={displayImage}
            alt={displayAlt}
            className="w-full h-[60vw] sm:h-[40vw] md:h-96 object-contain transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-2xl"></div>
        </div>

        {/* Small Image Icons */}
        <div className="flex space-x-2 mb-6 overflow-x-auto scrollbar-hide">
          {allImages.map((img: string) => (
            <img
              key={img}
              src={img}
              alt="Product icon"
              className={`w-14 h-14 sm:w-15 sm:h-16 object-cover rounded-lg cursor-pointer border-2 transition-all ${
                displayImage === img
                  ? 'border-yellow-400'
                  : 'border-transparent hover:border-yellow-400'
              }`}
              onClick={() => setDisplayImage(img)}
            />
          ))}
        </div>

        {/* Product Info */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 drop-shadow-lg">
          {product.title}
        </h1>
        <p className="text-xl sm:text-2xl text-yellow-300 font-bold mb-6 drop-shadow-md">
          £{product.priceRange.minVariantPrice.amount}
        </p>

        {/* Size Selector */}
        {availableSizes.length > 0 && (
          <div className="mb-4">
            <label className="text-white font-bold mr-2">Size:</label>
            <select
              className="p-2 sm:p-3 rounded-xl text-black font-semibold shadow-md hover:shadow-xl transition-all duration-300 w-full sm:w-auto cursor-pointer"
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
            >
              {sortedSizes.map((size: string) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}

        {/* Color Selector */}
        {availableColors.length > 0 && (
          <div className="mb-6">
            <label className="text-white font-bold mr-2">Color:</label>
            <select
              className="p-2 sm:p-3 rounded-xl text-black font-semibold shadow-md hover:shadow-xl transition-all duration-300 w-full sm:w-auto cursor-pointer"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
            >
              {availableColors.map((color: string) => (
                <option key={color} value={color}>
                  {colorNameMap[color] || color}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Stock Status */}
        {!inStock && (
          <p className="text-red-500 font-bold mb-4 text-lg">
            Out of Stock
          </p>
        )}

        {/* Buy Button */}
        <button
          disabled={!inStock}
          className={`w-full sm:w-auto font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-lg transition-all duration-300 text-lg sm:text-xl md:text-2xl cursor-pointer
            ${inStock ? 'bg-yellow-400 text-purple-900 hover:shadow-2xl hover:bg-yellow-500' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}
        >
          {inStock ? 'Buy Now' : 'Unavailable'}
        </button>

      </div>
    </main>
  );
}
