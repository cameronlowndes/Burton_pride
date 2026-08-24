import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FooterLinkSection = "explore" | "get_involved";

type FooterLinkInput = {
  id?: string;
  label: string;
  url: string;
  section: FooterLinkSection;
  sortOrder: number;
  isEnabled: boolean;
};

type FooterSettingsInput = {
  tagline: string;
  organisationName: string;
  description: string;
  companyText: string;

  facebookUrl: string;
  facebookEnabled: boolean;

  instagramUrl: string;
  instagramEnabled: boolean;

  blueskyUrl: string;
  blueskyEnabled: boolean;

  supportButtonText: string;
  supportButtonUrl: string;
  supportButtonEnabled: boolean;

  adminLoginText: string;
  adminLoginUrl: string;
  adminLoginEnabled: boolean;

  developerCreditPrefix: string;
  developerCreditText: string;
  developerCreditUrl: string;
  developerCreditEnabled: boolean;

  copyrightText: string;
};

type PutBody = {
  settings?: Partial<FooterSettingsInput>;
  links?: FooterLinkInput[];
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Missing Supabase server environment variables. ` +
        `NEXT_PUBLIC_SUPABASE_URL=${Boolean(supabaseUrl)}, ` +
        `SUPABASE_SERVICE_ROLE_KEY=${Boolean(serviceRoleKey)}`,
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "Unknown server error";
  }
}

function adminError(
  publicMessage: string,
  error: unknown,
  status = 500,
) {
  return NextResponse.json(
    {
      success: false,
      error: publicMessage,

      /*
       * This route is for the authenticated Admin Portal.
       * The UI can display this field in its detailed error panel.
       */
      details: getErrorDetails(error),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function normaliseText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mapSettingsRow(row: any): FooterSettingsInput {
  return {
    tagline: row?.tagline ?? "",
    organisationName: row?.organisation_name ?? "",
    description: row?.description ?? "",
    companyText: row?.company_text ?? "",

    facebookUrl: row?.facebook_url ?? "",
    facebookEnabled: row?.facebook_enabled === true,

    instagramUrl: row?.instagram_url ?? "",
    instagramEnabled: row?.instagram_enabled === true,

    blueskyUrl: row?.bluesky_url ?? "",
    blueskyEnabled: row?.bluesky_enabled === true,

    supportButtonText: row?.support_button_text ?? "",
    supportButtonUrl: row?.support_button_url ?? "",
    supportButtonEnabled: row?.support_button_enabled === true,

    adminLoginText: row?.admin_login_text ?? "",
    adminLoginUrl: row?.admin_login_url ?? "",
    adminLoginEnabled: row?.admin_login_enabled === true,

    developerCreditPrefix: row?.developer_credit_prefix ?? "",
    developerCreditText: row?.developer_credit_text ?? "",
    developerCreditUrl: row?.developer_credit_url ?? "",
    developerCreditEnabled: row?.developer_credit_enabled === true,

    copyrightText: row?.copyright_text ?? "",
  };
}

function mapLinkRow(row: any): FooterLinkInput {
  return {
    id: row.id,
    label: row.label ?? "",
    url: row.url ?? "",
    section: row.section,
    sortOrder: row.sort_order ?? 0,
    isEnabled: row.is_enabled !== false,
  };
}

/*
 * IMPORTANT:
 * Keep your existing Admin Portal authentication/authorisation middleware
 * protecting /api/admin/*.
 *
 * If your project does not already protect /api/admin/* globally,
 * add your existing admin-session verification here before database access.
 */

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
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]);

    if (settingsResult.error) {
      console.error(
        "[api/admin/footer][GET] Footer settings error:",
        settingsResult.error,
      );

      return adminError(
        "Unable to load footer settings.",
        settingsResult.error,
      );
    }

    if (linksResult.error) {
      console.error(
        "[api/admin/footer][GET] Footer links error:",
        linksResult.error,
      );

      return adminError(
        "Unable to load footer links.",
        linksResult.error,
      );
    }

    const settings = mapSettingsRow(settingsResult.data);

    const links = (linksResult.data ?? []).map(mapLinkRow);

    return NextResponse.json(
      {
        success: true,
        settings,
        links,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/admin/footer][GET] Unexpected error:", error);

    return adminError(
      "Unable to load footer management data.",
      error,
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as PutBody;

    if (!body || typeof body !== "object") {
      return adminError(
        "Invalid request body.",
        "Expected a JSON request body.",
        400,
      );
    }

    const incomingSettings = body.settings ?? {};
    const incomingLinks = Array.isArray(body.links) ? body.links : [];

    const allowedSections = new Set<FooterLinkSection>([
      "explore",
      "get_involved",
    ]);

    for (const [index, link] of incomingLinks.entries()) {
      if (!allowedSections.has(link.section)) {
        return adminError(
          "Invalid footer link section.",
          `Link at index ${index} has invalid section "${String(
            link.section,
          )}".`,
          400,
        );
      }

      const label = normaliseText(link.label);
      const url = normaliseText(link.url);

      if (!label && url) {
        return adminError(
          "A footer link is missing its name.",
          `Link at index ${index} has a URL but no label.`,
          400,
        );
      }

      if (label && !url) {
        return adminError(
          "A footer link is missing its URL.",
          `Link "${label}" has no URL or route.`,
          400,
        );
      }
    }

    const supabase = getSupabaseAdmin();

    const existingSettingsResult = await supabase
      .from("website_footer_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSettingsResult.error) {
      console.error(
        "[api/admin/footer][PUT] Existing settings lookup error:",
        existingSettingsResult.error,
      );

      return adminError(
        "Unable to check existing footer settings.",
        existingSettingsResult.error,
      );
    }

    const settingsPayload = {
      tagline: normaliseText(incomingSettings.tagline),
      organisation_name: normaliseText(
        incomingSettings.organisationName,
      ),
      description: normaliseText(incomingSettings.description),
      company_text: normaliseText(incomingSettings.companyText),

      facebook_url: normaliseText(incomingSettings.facebookUrl),
      facebook_enabled: incomingSettings.facebookEnabled === true,

      instagram_url: normaliseText(incomingSettings.instagramUrl),
      instagram_enabled: incomingSettings.instagramEnabled === true,

      bluesky_url: normaliseText(incomingSettings.blueskyUrl),
      bluesky_enabled: incomingSettings.blueskyEnabled === true,

      support_button_text: normaliseText(
        incomingSettings.supportButtonText,
      ),
      support_button_url: normaliseText(
        incomingSettings.supportButtonUrl,
      ),
      support_button_enabled:
        incomingSettings.supportButtonEnabled === true,

      admin_login_text: normaliseText(incomingSettings.adminLoginText),
      admin_login_url: normaliseText(incomingSettings.adminLoginUrl),
      admin_login_enabled: incomingSettings.adminLoginEnabled === true,

      developer_credit_prefix: normaliseText(
        incomingSettings.developerCreditPrefix,
      ),
      developer_credit_text: normaliseText(
        incomingSettings.developerCreditText,
      ),
      developer_credit_url: normaliseText(
        incomingSettings.developerCreditUrl,
      ),
      developer_credit_enabled:
        incomingSettings.developerCreditEnabled === true,

      copyright_text: normaliseText(incomingSettings.copyrightText),

      updated_at: new Date().toISOString(),
    };

    let savedSettingsResult;

    if (existingSettingsResult.data?.id) {
      savedSettingsResult = await supabase
        .from("website_footer_settings")
        .update(settingsPayload)
        .eq("id", existingSettingsResult.data.id)
        .select("*")
        .single();
    } else {
      savedSettingsResult = await supabase
        .from("website_footer_settings")
        .insert(settingsPayload)
        .select("*")
        .single();
    }

    if (savedSettingsResult.error) {
      console.error(
        "[api/admin/footer][PUT] Settings save error:",
        savedSettingsResult.error,
      );

      return adminError(
        "Unable to save footer settings.",
        savedSettingsResult.error,
      );
    }

    /*
     * Replace the managed link set in one save.
     *
     * This keeps add/remove/reorder behaviour simple and ensures that
     * removing a link in the Admin Portal removes it from Supabase too.
     */
    const deleteLinksResult = await supabase
      .from("website_footer_links")
      .delete()
      .in("section", ["explore", "get_involved"]);

    if (deleteLinksResult.error) {
      console.error(
        "[api/admin/footer][PUT] Link replacement delete error:",
        deleteLinksResult.error,
      );

      return adminError(
        "Footer settings were saved, but existing footer links could not be replaced.",
        deleteLinksResult.error,
      );
    }

    const linksToInsert = incomingLinks
      .map((link, index) => ({
        section: link.section,
        label: normaliseText(link.label),
        url: normaliseText(link.url),
        sort_order:
          Number.isFinite(link.sortOrder) && link.sortOrder > 0
            ? link.sortOrder
            : index + 1,
        is_enabled: link.isEnabled !== false,
      }))
      .filter((link) => link.label && link.url);

    let savedLinkRows: any[] = [];

    if (linksToInsert.length > 0) {
      const insertLinksResult = await supabase
        .from("website_footer_links")
        .insert(linksToInsert)
        .select("*")
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true });

      if (insertLinksResult.error) {
        console.error(
          "[api/admin/footer][PUT] Link insert error:",
          insertLinksResult.error,
        );

        return adminError(
          "Footer settings were saved, but footer links could not be saved.",
          insertLinksResult.error,
        );
      }

      savedLinkRows = insertLinksResult.data ?? [];
    }

    return NextResponse.json(
      {
        success: true,
        message: "Footer saved successfully.",
        settings: mapSettingsRow(savedSettingsResult.data),
        links: savedLinkRows.map(mapLinkRow),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/admin/footer][PUT] Unexpected error:", error);

    return adminError(
      "Unable to save footer.",
      error,
    );
  }
}
