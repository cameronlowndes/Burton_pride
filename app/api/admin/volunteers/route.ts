import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type VolunteerStatus = "new" | "in_progress" | "done";

type VolunteerRow = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  availability: string | null;
  experience: string | null;
  why_volunteer: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  status: VolunteerStatus;
  is_read: boolean;
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("volunteer_applications")
      .select(
        `
        id,
        created_at,
        full_name,
        email,
        phone,
        date_of_birth,
        availability,
        experience,
        why_volunteer,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        status,
        is_read
        `
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load volunteer applications",
        },
        { status: 500 }
      );
    }

    const volunteers: VolunteerRow[] = Array.isArray(data)
      ? data.map((row: any) => ({
          id: row.id,
          created_at: row.created_at,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone ?? null,
          date_of_birth: row.date_of_birth ?? null,
          availability: row.availability ?? null,
          experience: row.experience ?? null,
          why_volunteer: row.why_volunteer ?? null,
          emergency_contact_name: row.emergency_contact_name ?? null,
          emergency_contact_phone: row.emergency_contact_phone ?? null,
          emergency_contact_relationship:
            row.emergency_contact_relationship ?? null,
          status: row.status ?? "new",
          is_read: Boolean(row.is_read),
        }))
      : [];

    const stats = {
      totalApplications: volunteers.length,
      newApplications: volunteers.filter((v) => v.status === "new").length,
      inProgressApplications: volunteers.filter(
        (v) => v.status === "in_progress"
      ).length,
      doneApplications: volunteers.filter((v) => v.status === "done").length,
    };

    return NextResponse.json({
      ok: true,
      stats,
      volunteers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Server error while loading volunteer applications",
      },
      { status: 500 }
    );
  }
}