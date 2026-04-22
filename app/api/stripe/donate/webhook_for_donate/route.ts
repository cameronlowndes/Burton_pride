import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

function formatAmount(amount?: number | null) {
  return ((amount || 0) / 100).toFixed(2);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error);
    return new NextResponse("Invalid webhook signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const donorName = session.metadata?.fullName?.trim() || "Supporter";
      const donorEmail =
        session.customer_details?.email?.trim() ||
        session.metadata?.email?.trim() ||
        "";
      const donorMessage = session.metadata?.message?.trim() || "";
      const donationAmount = formatAmount(session.amount_total);

      const safeDonorName = escapeHtml(donorName);
      const safeDonorEmail = escapeHtml(donorEmail);
      const safeDonorMessage = escapeHtml(donorMessage);

      if (donorEmail) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: donorEmail,
          subject: "Thank you for supporting Burton Pride C.I.C",
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827; max-width: 640px; margin: 0 auto;">
              <div style="padding: 32px 24px; background: linear-gradient(135deg, #db2777, #a21caf, #2563eb); color: white; border-radius: 20px 20px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Thank You For Your Donation</h1>
                <p style="margin: 12px 0 0; font-size: 16px; opacity: 0.95;">
                  Burton Pride C.I.C
                </p>
              </div>

              <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 20px 20px; padding: 32px 24px;">
                <p style="margin-top: 0;">Hi ${safeDonorName},</p>

                <p>
                  Thank you so much for your donation of <strong>£${donationAmount}</strong> to Burton Pride C.I.C.
                </p>

                <p>
                  Burton Pride is a grassroots, community-led organisation built by local people, for local people.
                  Every donation helps us continue creating inclusive events, safer spaces, stronger visibility,
                  accessibility support, and meaningful opportunities for the LGBTQIA+ community and allies in Burton on Trent.
                </p>

                <p>
                  As a Community Interest Company, our focus is always on community impact. Your support helps us keep building
                  something real, welcoming, and rooted in pride, care, and togetherness.
                </p>

                <p>
                  Your kindness truly makes a difference, and we are very grateful for your support.
                </p>

                <p style="margin-bottom: 0;">
                  With heartfelt thanks,<br />
                  <strong>Burton Pride C.I.C</strong>
                </p>
              </div>
            </div>
          `,
        });
      }

      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: process.env.NOTIFY_EMAIL!,
        subject: `New donation received - £${donationAmount}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827; max-width: 640px; margin: 0 auto;">
            <div style="padding: 24px; background: #111827; color: white; border-radius: 20px 20px 0 0;">
              <h2 style="margin: 0;">New Burton Pride Donation</h2>
            </div>

            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 20px 20px; padding: 24px;">
              <p><strong>Name:</strong> ${safeDonorName}</p>
              <p><strong>Email:</strong> ${safeDonorEmail || "No email provided"}</p>
              <p><strong>Amount:</strong> £${donationAmount}</p>
              <p><strong>Stripe Session ID:</strong> ${escapeHtml(session.id)}</p>
              <p><strong>Payment Status:</strong> ${escapeHtml(session.payment_status || "unknown")}</p>
              <p><strong>Message:</strong><br />${safeDonorMessage || "No message provided"}</p>
            </div>
          </div>
        `,
      });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Stripe webhook_for_donate error:", error);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}