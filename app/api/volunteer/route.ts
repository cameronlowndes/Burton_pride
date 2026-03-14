import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body?.phone || "").trim();
    const date_of_birth = String(body?.date_of_birth || "").trim();
    const availability = String(body?.availability || "").trim();
    const experience = String(body?.experience || "").trim();
    const why_volunteer = String(body?.why_volunteer || "").trim();

    const emergency_contact_name = String(
      body?.emergency_contact_name || ""
    ).trim();
    const emergency_contact_phone = String(
      body?.emergency_contact_phone || ""
    ).trim();
    const emergency_contact_relationship = String(
      body?.emergency_contact_relationship || ""
    ).trim();

    if (
      !full_name ||
      !email ||
      !date_of_birth ||
      !why_volunteer ||
      !emergency_contact_name ||
      !emergency_contact_phone ||
      !emergency_contact_relationship
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Full name, email, date of birth, why you want to volunteer, and all emergency contact fields are required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("volunteer_applications")
      .insert([
        {
          full_name,
          email,
          phone: phone || null,
          date_of_birth: date_of_birth || null,
          availability: availability || null,
          experience: experience || null,
          why_volunteer,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relationship,
          status: "new",
          is_read: false,
        },
      ])
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to save volunteer application.",
        },
        { status: 500 }
      );
    }

    const whatsappLink = process.env.VOLUNTEER_WHATSAPP_LINK;
    const adminEmail = "prideburton@gmail.com";

    const safeName = escapeHtml(full_name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || "Not provided");
    const safeDob = escapeHtml(date_of_birth || "Not provided");
    const safeAvailability = escapeHtml(availability || "Not provided");
    const safeExperience = escapeHtml(experience || "Not provided");
    const safeWhyVolunteer = escapeHtml(why_volunteer);
    const safeEmergencyName = escapeHtml(emergency_contact_name);
    const safeEmergencyPhone = escapeHtml(emergency_contact_phone);
    const safeEmergencyRelationship = escapeHtml(
      emergency_contact_relationship
    );

    // Volunteer confirmation email
    try {
      await resend.emails.send({
        from:
          process.env.FROM_EMAIL ||
          "Burton Pride <noreply@burtonpride.co.uk>",
        to: email,
        subject: "Thank you for applying to volunteer with Burton Pride",
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
            <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

              <div style="background:linear-gradient(135deg,#ec4899,#8b5cf6,#3b82f6);padding:28px 24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;">Burton Pride</h1>
                <p style="margin:10px 0 0;color:#fdf2f8;">Volunteer Application Received</p>
              </div>

              <div style="padding:32px 24px;">
                <p>Hi ${safeName},</p>

                <p>
                  Thank you for your volunteer application to <strong>Burton Pride</strong>.
                </p>

                <p>
                  We are proud to be a grassroots community organisation in Burton and proud to support our local LGBTQIA+ community and allies.
                </p>

                <p>
                  We are really pleased that you want to get involved. Olga will review your application and aim to be in touch within <strong>2 working days</strong>.
                </p>

                ${
                  whatsappLink
                    ? `
                <p>We also have a WhatsApp group for volunteers.</p>

                <div style="text-align:center;margin:28px 0;">
                  <a
                    href="${whatsappLink}"
                    style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700;"
                  >
                    Join the Volunteer WhatsApp Group
                  </a>
                </div>
                `
                    : ""
                }

                <p>
                  Thank you again for applying and supporting Burton Pride.
                </p>

                <p>
                  Kind regards,<br/>
                  <strong>Burton Pride C.I.C</strong>
                </p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Volunteer email failed:", emailError);
    }

    // Admin notification email
    try {
      await resend.emails.send({
        from:
          process.env.FROM_EMAIL ||
          "Burton Pride <noreply@burtonpride.co.uk>",
        to: adminEmail,
        replyTo: email,
        subject: `New volunteer application: ${full_name}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
            <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

              <div style="background:#111827;padding:24px;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;">New Volunteer Application</h1>
                <p style="margin:10px 0 0;color:#cbd5e1;">
                  A new volunteer application has been submitted.
                </p>
              </div>

              <div style="padding:24px;">
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Phone:</strong> ${safePhone}</p>
                <p><strong>Date of Birth:</strong> ${safeDob}</p>
                <p><strong>Availability:</strong> ${safeAvailability}</p>
                <p><strong>Experience:</strong> ${safeExperience}</p>

                <h3 style="margin-top:24px;">Why they want to volunteer</h3>
                <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;white-space:pre-wrap;line-height:1.6;">
                  ${safeWhyVolunteer}
                </div>

                <h3 style="margin-top:24px;">Emergency Contact</h3>
                <p><strong>Name:</strong> ${safeEmergencyName}</p>
                <p><strong>Phone:</strong> ${safeEmergencyPhone}</p>
                <p><strong>Relationship:</strong> ${safeEmergencyRelationship}</p>

                <p style="margin-top:24px;color:#475569;font-size:14px;">
                  Replying to this email will reply directly to the volunteer.
                </p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (adminEmailError) {
      console.error("Admin email failed:", adminEmailError);
    }

    return NextResponse.json({
      ok: true,
      message: "Volunteer application submitted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}