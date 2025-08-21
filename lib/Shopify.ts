// lib/shopify.ts
export async function fetchShopify(query: string) {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  if (!domain) {
    throw new Error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN in .env.local");
  }
  if (!token) {
    throw new Error("Missing NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN in .env.local");
  }

  try {
    const res = await fetch(`https://${domain}/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify request failed: ${res.status} - ${text}`);
    }

    const json = await res.json();

    // Log full response for debugging
    console.log("Shopify response JSON:", JSON.stringify(json, null, 2));

    if (json.errors) {
      console.error("Shopify GraphQL errors:", json.errors);
      throw new Error("Shopify GraphQL error. Check console for details.");
    }

    if (!json.data) {
      throw new Error("Shopify returned no data. Check your query and permissions.");
    }

    return json.data;
  } catch (error) {
    console.error("Shopify fetch error:", error);
    throw error;
  }
}
