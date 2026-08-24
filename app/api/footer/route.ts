import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const IS_DEV = process.env.NODE_ENV === "development";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Missing Supabase environment variables. NEXT_PUBLIC_SUPABASE_URL=${Boolean(
        supabaseUrl,
      )}, SUPABASE_SERVICE_ROLE_KEY=${Boolean(serviceRoleKey)}`,
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function errorResponse(
  publicMessage: string,
  error: unknown,
  status = 500,
) {
  const details =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return NextResponse.json(
    {
      success: false,
      error: publicMessage,
      ...(IS_DEV ? { details } : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [settingsResult, linksResult] = await Promise.all([
      supabase
        .from("website_footer_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("website_footer_links")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    if (settingsResult.error) {
      console.error(
        "[website/footer] settings error:",
        settingsResult.error,
      );

      return errorResponse(
        "Unable to load footer settings.",
        settingsResult.error,
      );
    }

    if (linksResult.error) {
      console.error(
        "[website/footer] links error:",
        linksResult.error,
      );

      return errorResponse(
        "Unable to load footer links.",
        linksResult.error,
      );
    }

    const row = settingsResult.data;
    const links = linksResult.data ?? [];

    const explore = links
      .filter((link) => link.section === "explore")
      .map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
        sortOrder: link.sort_order ?? 0,
        isEnabled: link.is_enabled !== false,
      }));

    const getInvolved = links
      .filter((link) => link.section === "get_involved")
      .map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
        sortOrder: link.sort_order ?? 0,
        isEnabled: link.is_enabled !== false,
      }));

    const settings = row
      ? {
          tagline: row.tagline,
          organisationName: row.organisation_name,
          description: row.description,
          companyText: row.company_text,

          socials: {
            facebook: {
              enabled: row.facebook_enabled,
              url: row.facebook_url,
            },
            instagram: {
              enabled: row.instagram_enabled,
              url: row.instagram_url,
            },
            bluesky: {
              enabled: row.bluesky_enabled,
              url: row.bluesky_url,
            },
          },

          supportButton: {
            enabled: row.support_button_enabled,
            text: row.support_button_text,
            url: row.support_button_url,
          },

          adminLogin: {
            enabled: row.admin_login_enabled,
            text: row.admin_login_text,
            url: row.admin_login_url,
          },

          developerCredit: {
            enabled: row.developer_credit_enabled,
            prefix: row.developer_credit_prefix,
            text: row.developer_credit_text,
            url: row.developer_credit_url,
          },

          copyrightText: row.copyright_text,
        }
      : null;

    return NextResponse.json(
      {
        success: true,
        settings,
        sections: {
          explore,
          getInvolved,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("[website/footer] unexpected error:", error);

    return errorResponse(
      "Unable to load footer.",
      error,
    );
  }
}
