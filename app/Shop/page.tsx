// app/shop/page.tsx
import ShopClient from "../components/Shop/ShopClient";
import { fetchShopify } from '../../lib/Shopify';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Burton Pride Shop | Exclusive Merchandise",
  description: "Browse and shop Burton Pride's official merchandise, including apparel and accessories celebrating diversity, inclusion, and love in Burton",
  icons: {
    icon: "/image/logo.jpg",
  },
};

interface Product {
  id: string;
  title: string;
  handle: string;
  imageUrl: string;
  imageAlt: string;
  price: string;
}

export default async function ShopPage() {
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
    const data = await fetchShopify(query);

    const products: Product[] = data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      imageUrl: edge.node.images.edges[0]?.node.url ?? '',
      imageAlt: edge.node.images.edges[0]?.node.altText ?? edge.node.title,
      price: edge.node.priceRange.minVariantPrice.amount,
    }));

    return (
      <main className="pt-28 pb-16 px-6 bg-gradient-to-br min-h-screen">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-12 text-center text-white drop-shadow-lg">
          Welcome to the Burton Pride Shop
        </h1>

        <ShopClient products={products} />
      </main>
    );
  } catch (error) {
    console.error(error);
    return <p className="p-10 text-center text-red-500 text-2xl">Failed to load products.</p>;
  }
}
