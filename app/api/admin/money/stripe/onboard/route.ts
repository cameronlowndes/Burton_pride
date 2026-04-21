import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-02-25.clover",
});

async function requireUser() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
    };
  }

  return {
    ok: true as const,
    userId,
  };
}

export async function POST() {
  try {
    const access = await requireUser();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_URL;

    if (!appUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_URL" },
        { status: 500 }
      );
    }

    if (!/^https?:\/\//.test(appUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: "NEXT_PUBLIC_APP_URL must start with http:// or https://",
        },
        { status: 500 }
      );
    }

    const { data: existingConnection, error: lookupError } = await supabaseAdmin
      .from("money_stripe_connections")
      .select("*")
      .eq("clerk_user_id", access.userId)
      .maybeSingle();

    if (lookupError) {
      console.error("Stripe connection lookup error:", lookupError);
      return NextResponse.json(
        { ok: false, error: "Failed to load Stripe connection" },
        { status: 500 }
      );
    }

    let stripeAccountId = existingConnection?.stripe_account_id as string | undefined;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
      });

      stripeAccountId = account.id;

      const { error: insertError } = await supabaseAdmin
        .from("money_stripe_connections")
        .insert({
          clerk_user_id: access.userId,
          stripe_account_id: stripeAccountId,
          account_type: "express",
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
          details_submitted: account.details_submitted ?? false,
          country: account.country ?? null,
          email: account.email ?? null,
        });

      if (insertError) {
        console.error("Stripe connection insert error:", insertError);
        return NextResponse.json(
          { ok: false, error: "Failed to save Stripe account" },
          { status: 500 }
        );
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/Admin/Money/Stripe?refresh=1`,
      return_url: `${appUrl}/Admin/Money/Stripe/Return`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      url: accountLink.url,
    });
  } catch (error) {
    console.error("Stripe onboarding error full:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code ?? null,
          type: error.type ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Failed to create Stripe onboarding link" },
      { status: 500 }
    );
  }
}