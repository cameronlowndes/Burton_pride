import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req: NextRequest) {
  try {
    const { businessName, contactName, email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Windows of Hope Competition Entry',
              description: `Entry by ${businessName} (${contactName})`,
            },
            unit_amount: 200,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_URL}/competition/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/competition`,
      customer_email: email,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Stripe checkout failed' },
      { status: 500 }
    );
  }
}
