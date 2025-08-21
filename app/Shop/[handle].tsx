'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchShopify } from '../../lib/Shopify';

interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  price: string;
  variants: ProductVariant[];
}

export default function ProductPage() {
  const { handle } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const query = `
          {
            productByHandle(handle: "${handle}") {
              id
              title
              description
              images(first: 5) {
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
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                  }
                }
              }
            }
          }
        `;
        const data = await fetchShopify(query);
        const prod = data.productByHandle;

        setProduct({
          id: prod.id,
          title: prod.title,
          description: prod.description,
          imageUrl: prod.images.edges[0]?.node.url ?? '',
          imageAlt: prod.images.edges[0]?.node.altText ?? prod.title,
          price: prod.priceRange.minVariantPrice.amount,
          variants: prod.variants.edges.map((v: any) => v.node),
        });

        if (prod.variants.edges.length > 0) {
          setSelectedVariant(prod.variants.edges[0].node.id);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to load product.');
        setLoading(false);
      }
    };

    fetchProduct();
  }, [handle]);

  if (loading) return <p className="text-center p-10">Loading product...</p>;
  if (error || !product) return <p className="text-center p-10">{error || 'Product not found'}</p>;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
      <img src={product.imageUrl} alt={product.imageAlt} className="w-full rounded-lg mb-6" />
      <p className="mb-4">{product.description}</p>
      <p className="text-xl font-semibold mb-4">£{product.price}</p>

      <div className="mb-4">
        <label className="font-bold mr-2">Choose Variant:</label>
        <select
          className="border rounded p-2"
          value={selectedVariant ?? ''}
          onChange={(e) => setSelectedVariant(e.target.value)}
        >
          {product.variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.title} {variant.availableForSale ? '' : '(Sold Out)'}
            </option>
          ))}
        </select>
      </div>

      <button
        className="bg-yellow-400 text-purple-900 font-bold px-6 py-3 rounded-full shadow-lg hover:bg-yellow-500 transition"
        onClick={() =>
          window.open(
            `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN}/cart/${selectedVariant}:1`,
            '_blank'
          )
        }
      >
        Add to Cart
      </button>
    </main>
  );
}
