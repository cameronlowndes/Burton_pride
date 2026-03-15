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

    const sponsor_name = String(body?.sponsor_name || "").trim();
    const contact_name = String(body?.contact_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const sponsorship_type = String(body?.sponsorship_type || "").trim();

    const address_line1 = String(body?.address_line1 || "").trim();
    const address_line2 = String(body?.address_line2 || "").trim();
    const city = String(body?.city || "").trim();
    const county = String(body?.county || "").trim();
    const postcode = String(body?.postcode || "").trim();
    const country = String(body?.country || "").trim();

    const logo_link = String(body?.logo_link || "").trim();
    const message = String(body?.message || "").trim();

    if (!sponsor_name || !contact_name || !email || !sponsorship_type) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sponsor name, contact name, email and sponsorship type are required.",
        },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("sponsor_applications")
      .insert({
        sponsor_name,
        contact_name,
        email,
        phone,
        sponsorship_type,
        address_line1,
        address_line2,
        city,
        county,
        postcode,
        country,
        logo_link,
        message,
      });

    if (insertError) {
      throw new Error(insertError.message || "Failed to save sponsor enquiry");
    }

    const safeSponsorName = escapeHtml(sponsor_name);
    const safeContactName = escapeHtml(contact_name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || "Not provided");
    const safeSponsorshipType = escapeHtml(sponsorship_type);

    const safeAddressLine1 = escapeHtml(address_line1 || "Not provided");
    const safeAddressLine2 = escapeHtml(address_line2 || "Not provided");
    const safeCity = escapeHtml(city || "Not provided");
    const safeCounty = escapeHtml(county || "Not provided");
    const safePostcode = escapeHtml(postcode || "Not provided");
    const safeCountry = escapeHtml(country || "Not provided");
    const safeMessage = escapeHtml(message || "No message provided");
    const safeLogoLink = escapeHtml(logo_link);

    const sponsorEmailResult = await resend.emails.send({
      from: "Burton Pride <noreply@burtonpride.co.uk>",
      to: email,
      subject: "Thank you for your interest in supporting Burton Pride",
      text: `Thank you for your interest in supporting Burton Pride.

Burton Pride is a community-led organisation dedicated to celebrating, supporting, and uplifting the LGBTQIA+ community in Burton and the surrounding areas.

We strongly believe in the power of community and the importance of creating safe, inclusive spaces where everyone can feel respected, valued, and proud of who they are.

With the support of local businesses and organisations such as your company, we are able to continue building events, initiatives, and opportunities that strengthen the LGBTQIA+ community while bringing people together across our town.

Every partnership helps us grow a more inclusive, supportive, and visible community for everyone.

We truly appreciate your company's interest in working with Burton Pride and supporting our mission. A member of our team will review your sponsorship enquiry and get back to you as soon as possible.

Thank you again for your support and for helping us continue building a stronger, more inclusive, and more connected community in Burton.

Kind regards,
Burton Pride C.I.C`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #111827; max-width: 700px; margin: 0 auto;">
          <div style="padding: 24px; background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6); border-radius: 16px 16px 0 0; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Burton Pride</h1>
            <p style="margin: 8px 0 0 0;">Thank you for your interest in supporting our work</p>
          </div>

          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 16px 16px; background: #ffffff;">
            <p>Thank you for your interest in supporting Burton Pride.</p>

            <p>
              Burton Pride is a community-led organisation dedicated to celebrating,
              supporting, and uplifting the LGBTQIA+ community in Burton and the
              surrounding areas.
            </p>

            <p>
              We strongly believe in the power of community and the importance of
              creating safe, inclusive spaces where everyone can feel respected,
              valued, and proud of who they are.
            </p>

            <p>
              With the support of local businesses and organisations such as your
              company, we are able to continue building events, initiatives, and
              opportunities that strengthen the LGBTQIA+ community while bringing
              people together across our town.
            </p>

            <p>
              Every partnership helps us grow a more inclusive, supportive, and
              visible community for everyone.
            </p>

            <p>
              We truly appreciate your company's interest in working with Burton Pride
              and supporting our mission. A member of our team will review your
              sponsorship enquiry and get back to you as soon as possible.
            </p>

            <p>
              Thank you again for your support and for helping us continue building a
              stronger, more inclusive, and more connected community in Burton.
            </p>

            <p style="margin-top: 24px;">
              Kind regards,<br />
              <strong>Burton Pride C.I.C</strong>
            </p>
          </div>
        </div>
      `,
    });

    const adminEmailResult = await resend.emails.send({
      from: "Burton Pride <noreply@burtonpride.co.uk>",
      to: "prideburton@gmail.com",
      subject: `New Sponsor Enquiry - ${sponsor_name}`,
      text: `A new sponsor enquiry has been submitted.

Company / Sponsor Name: ${sponsor_name}
Contact Name: ${contact_name}
Email: ${email}
Phone: ${phone || "Not provided"}
Sponsorship Type: ${sponsorship_type}

Business Address:
Address Line 1: ${address_line1 || "Not provided"}
Address Line 2: ${address_line2 || "Not provided"}
Town / City: ${city || "Not provided"}
County: ${county || "Not provided"}
Postcode: ${postcode || "Not provided"}
Country: ${country || "Not provided"}

Message / Requirements:
${message || "No message provided"}

Logo Link:
${logo_link || "No logo uploaded"}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 760px; margin: 0 auto;">
          <div style="padding: 24px; background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6); border-radius: 16px 16px 0 0; color: white;">
            <h1 style="margin: 0; font-size: 24px;">New Sponsor Enquiry</h1>
            <p style="margin: 8px 0 0 0;">A new sponsor form has been submitted on the Burton Pride website.</p>
          </div>

          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 16px 16px; background: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 220px;">Company / Sponsor Name</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${safeSponsorName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Contact Name</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${safeContactName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                  <a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Phone</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${safePhone}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Sponsorship Type</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${safeSponsorshipType}</td>
              </tr>
            </table>

            <div style="margin-top: 24px;">
              <h2 style="font-size: 18px; margin-bottom: 12px;">Business Address</h2>
              <div style="padding: 16px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0;">${safeAddressLine1}</p>
                <p style="margin: 0 0 8px 0;">${safeAddressLine2}</p>
                <p style="margin: 0 0 8px 0;">${safeCity}</p>
                <p style="margin: 0 0 8px 0;">${safeCounty}</p>
                <p style="margin: 0 0 8px 0;">${safePostcode}</p>
                <p style="margin: 0;">${safeCountry}</p>
              </div>
            </div>

            <div style="margin-top: 24px;">
              <h2 style="font-size: 18px; margin-bottom: 12px;">Message / Requirements</h2>
              <div style="padding: 16px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb; white-space: pre-wrap;">
                ${safeMessage}
              </div>
            </div>

            ${
              logo_link
                ? `
                  <div style="margin-top: 24px;">
                    <h2 style="font-size: 18px; margin-bottom: 12px;">Logo</h2>
                    <p style="margin: 0 0 12px 0;">
                      <a href="${safeLogoLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none;">View uploaded logo</a>
                    </p>
                    <div style="padding: 16px; border-radius: 12px; background: #ffffff; border: 1px solid #e5e7eb; display: inline-block;">
                      <img src="${safeLogoLink}" alt="Sponsor logo" style="max-width: 220px; max-height: 120px; object-fit: contain;" />
                    </div>
                  </div>
                `
                : `
                  <div style="margin-top: 24px;">
                    <h2 style="font-size: 18px; margin-bottom: 12px;">Logo</h2>
                    <p style="margin: 0;">No logo uploaded.</p>
                  </div>
                `
            }
          </div>
        </div>
      `,
    });

    if ((sponsorEmailResult as any)?.error) {
      throw new Error((sponsorEmailResult as any).error.message || "Failed to send sponsor email");
    }

    if ((adminEmailResult as any)?.error) {
      throw new Error((adminEmailResult as any).error.message || "Failed to send admin email");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}