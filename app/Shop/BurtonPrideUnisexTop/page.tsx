import ProductClient from "../../components/ShopClient/ProductClientTop";
import { fetchShopify } from '../../../lib/Shopify';

export default async function BurtonPrideTopPage() {
  const query = `
    {
      productByHandle(handle: "burton-pride-unisex-top") {
        id
        title
        images(first:10){edges{node{url altText}}}
        priceRange{minVariantPrice{amount}}
        options{
          name
          values
        }
        variants(first:10){
          edges{
            node{
              id
              title
              availableForSale
              selectedOptions{
                name
                value
              }
              image{
                url
                altText
              }
            }
          }
        }
      }
    }
  `;
  const data = await fetchShopify(query);
  const product = data.productByHandle;

  return <ProductClient product={product} />;
}
