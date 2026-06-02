import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

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

function normaliseStatus(value: unknown): VolunteerStatus {
  if (value === "in_progress") return "in_progress";
  if (value === "done") return "done";
  return "new";
}

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
          status: normaliseStatus(row.status),
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim();

    if (!full_name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Full name is required",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error: "Email is required",
        },
        { status: 400 }
      );
    }

    const payload = {
      full_name,
      email,
      phone: body?.phone ? String(body.phone).trim() : null,
      date_of_birth: body?.date_of_birth
        ? String(body.date_of_birth).trim()
        : null,
      availability: body?.availability
        ? String(body.availability).trim()
        : null,
      experience: body?.experience ? String(body.experience).trim() : null,
      why_volunteer: body?.why_volunteer
        ? String(body.why_volunteer).trim()
        : null,
      emergency_contact_name: body?.emergency_contact_name
        ? String(body.emergency_contact_name).trim()
        : null,
      emergency_contact_phone: body?.emergency_contact_phone
        ? String(body.emergency_contact_phone).trim()
        : null,
      emergency_contact_relationship: body?.emergency_contact_relationship
        ? String(body.emergency_contact_relationship).trim()
        : null,
      status: normaliseStatus(body?.status),
      is_read: typeof body?.is_read === "boolean" ? body.is_read : true,
    };

    const { data, error } = await supabaseAdmin
      .from("volunteer_applications")
      .insert(payload)
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
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to create volunteer application",
        },
        { status: 500 }
      );
    }

    const volunteer: VolunteerRow = {
      id: data.id,
      created_at: data.created_at,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      date_of_birth: data.date_of_birth ?? null,
      availability: data.availability ?? null,
      experience: data.experience ?? null,
      why_volunteer: data.why_volunteer ?? null,
      emergency_contact_name: data.emergency_contact_name ?? null,
      emergency_contact_phone: data.emergency_contact_phone ?? null,
      emergency_contact_relationship:
        data.emergency_contact_relationship ?? null,
      status: normaliseStatus(data.status),
      is_read: Boolean(data.is_read),
    };

    return NextResponse.json(
      {
        ok: true,
        volunteer,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Server error while creating volunteer application",
      },
      { status: 500 }
    );
  }
}