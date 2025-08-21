// pages/shop.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchShopify } from '../../lib/Shopify';

interface ProductImage {
  node: {
    url: string;
    altText: string | null;
  };
}

interface ProductEdge {
  node: {
    id: string;
    title: string;
    handle: string;
    images: {
      edges: ProductImage[];
    };
    priceRange: {
      minVariantPrice: {
        amount: string;
      };
    };
  };
}

interface ShopifyProductsResponse {
  products: {
    edges: ProductEdge[];
  };
}

interface Product {
  id: string;
  title: string;
  handle: string;
  imageUrl: string;
  imageAlt: string;
  price: string;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const query = `
          {
            products(first: 12) {
              edges {
                node {
                  id
                  title
                  handle
                  images(first: 1) {
                    edges {
                      node {
                        url
                        altText
                      }
                    }
                  }
                  priceRange {
                    minVariantPrice {
                      amount
                    }
                  }
                }
              }
            }
          }
        `;
        const data: ShopifyProductsResponse = await fetchShopify(query);

        const mappedProducts: Product[] = data.products.edges.map((edge) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          imageUrl: edge.node.images.edges[0]?.node.url ?? '',
          imageAlt: edge.node.images.edges[0]?.node.altText ?? edge.node.title,
          price: edge.node.priceRange.minVariantPrice.amount,
        }));

        setProducts(mappedProducts);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load products.');
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <p className="p-10 text-center text-2xl text-white">Loading products...</p>;
  if (error) return <p className="p-10 text-center text-red-500 text-2xl">{error}</p>;

  return (
    <main className="pt-28 pb-16 px-6 bg-gradient-to-br min-h-screen">
      <h1 className="text-5xl md:text-6xl font-extrabold mb-12 text-center text-white drop-shadow-lg">
        Your Burton Pride Shop
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">
        {products.map((product) => (
          <div
            key={product.id}
            className="relative bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500 hover:scale-105 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(255,255,255,0.15)]"
          >
            <div className="relative w-full h-64">
              <img
                src={product.imageUrl}
                alt={product.imageAlt}
                className="w-full h-full object-cover rounded-t-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-t-2xl"></div>
            </div>

            <div className="p-6 text-center">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{product.title}</h2>
              <p className="text-lg text-yellow-300 font-semibold mb-4">£{product.price}</p>

              {/* Updated: internal dynamic route */}
              <Link
                href={`/shop/${product.handle}`}
                className="inline-block bg-yellow-400 text-purple-900 font-bold px-6 py-3 rounded-full shadow-lg hover:shadow-2xl hover:bg-yellow-500 transition-all duration-300"
              >
                View Product
              </Link>
            </div>

            <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none animate-pulse"></div>
          </div>
        ))}
      </div>
    </main>
  );
}
