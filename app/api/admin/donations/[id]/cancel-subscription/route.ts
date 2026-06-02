import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const password = String(body.password || "");
    const mainPassword = process.env.MAIN_ADMIN_DELETE_PASSWORD;

    if (!mainPassword) {
      return NextResponse.json(
        { ok: false, error: "Main admin password is not set in env." },
        { status: 500 }
      );
    }

    if (password !== mainPassword) {
      return NextResponse.json(
        { ok: false, error: "Wrong main admin password." },
        { status: 403 }
      );
    }

    const { data: donation, error } = await supabaseAdmin
      .from("donations")
      .select("id, stripe_subscription_id, donation_type")
      .eq("id", id)
      .single();

    if (error || !donation) {
      return NextResponse.json(
        { ok: false, error: "Donation not found" },
        { status: 404 }
      );
    }

    if (donation.donation_type !== "monthly") {
      return NextResponse.json(
        { ok: false, error: "This is not a monthly donation" },
        { status: 400 }
      );
    }

    if (!donation.stripe_subscription_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No Stripe subscription ID found. This may be a manual supporter or old record.",
        },
        { status: 400 }
      );
    }

    await stripe.subscriptions.cancel(donation.stripe_subscription_id);

    const { error: updateError } = await supabaseAdmin
      .from("donations")
      .update({
        subscription_status: "cancelled",
        status: "cancelled",
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Monthly donation cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to cancel subscription",
      },
      { status: 500 }
    );
  }
}