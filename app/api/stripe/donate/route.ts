import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

function getAmountPence(selectedAmount: string, customAmount: string) {
  const raw =
    selectedAmount === "Custom"
      ? customAmount
      : selectedAmount.replace("£", "");

  const amount = Number(raw);

  if (!amount || amount < 1) {
    throw new Error("Donation amount must be at least £1");
  }

  return Math.round(amount * 100);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fullName,
      email,
      message,
      supporterStory,
      supporterImagePreview,
      supporterImageName,
      selectedAmount,
      customAmount,
      donationType,
    } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { ok: false, error: "Full name and email are required" },
        { status: 400 }
      );
    }

    const amountPence = getAmountPence(selectedAmount, customAmount);
    const isMonthly = donationType === "monthly";

    const appUrl = process.env.NEXT_PUBLIC_URL;

    if (!appUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_URL" },
        { status: 500 }
      );
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: isMonthly ? "subscription" : "payment",
      customer_email: email,
      success_url: `${appUrl}/DonateToUs/Success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/DonateToUs`,
      metadata: {
        fullName,
        email,
        message: message || "",
        supporterStory: isMonthly ? supporterStory || "" : "",
        supporterImageName: isMonthly ? supporterImageName || "" : "",
        donationType: isMonthly ? "monthly" : "one_time",
        amountPence: String(amountPence),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            recurring: isMonthly ? { interval: "month" } : undefined,
            product_data: {
              name: isMonthly
                ? "Monthly Burton Pride Supporter"
                : "Burton Pride Donation",
              description: isMonthly
                ? "Monthly donation to support Burton Pride C.I.C"
                : "One-time donation to support Burton Pride C.I.C",
            },
          },
        },
      ],
    });

    const { error: insertError } = await supabaseAdmin.from("donations").insert({
      full_name: fullName,
      email,
      message: message || null,

      supporter_story: isMonthly ? supporterStory || null : null,
      supporter_story_status: isMonthly && supporterStory ? "pending" : null,
      supporter_wall_approved: false,
      supporter_display_name: isMonthly ? fullName : null,
      supporter_image_url: isMonthly ? supporterImagePreview || null : null,

      donation_type: isMonthly ? "monthly" : "one_time",
      amount_pence: amountPence,
      currency: "gbp",

      stripe_checkout_session_id: checkoutSession.id,
      status: "checkout_started",
    });

    if (insertError) {
      console.error("Donation insert error:", insertError);

      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Donate API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create donation checkout",
      },
      { status: 500 }
    );
  }
}