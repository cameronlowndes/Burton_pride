// app/api/admin/developmentrequests/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "rejected";

type RequestPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

const ALLOWED_STATUSES: RequestStatus[] = [
  "pending",
  "approved",
  "in_progress",
  "on_hold",
  "completed",
  "rejected",
];

const ALLOWED_PRIORITIES: RequestPriority[] = [
  "low",
  "normal",
  "high",
  "critical",
];

function errorResponse(message: string, status = 500) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return errorResponse(
        "Development request ID is required.",
        400
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return errorResponse(
        "You must be signed in to access this area.",
        401
      );
    }

    const {
      data: currentAdmin,
      error: adminError,
    } = await supabase
      .from("admin_users")
      .select(`
        id,
        name,
        email,
        role
      `)
      .ilike("email", user.email)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Development Requests admin lookup error:",
        adminError
      );

      return errorResponse(
        "Unable to verify your admin account.",
        500
      );
    }

    if (!currentAdmin) {
      return errorResponse(
        "You do not have permission to access Development Requests.",
        403
      );
    }

    // CORRECT TABLE
    const {
      data: developmentRequest,
      error: requestError,
    } = await supabase
      .from("admin_development_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      console.error(
        "Development Request GET database error:",
        requestError
      );

      return errorResponse(
        "Unable to load this development request.",
        500
      );
    }

    if (!developmentRequest) {
      return errorResponse(
        "Development request not found.",
        404
      );
    }

    const {
      data: admins,
      error: adminsError,
    } = await supabase
      .from("admin_users")
      .select(`
        id,
        name,
        email,
        role
      `)
      .order("name", {
        ascending: true,
      });

    if (adminsError) {
      console.error(
        "Development Requests admins list error:",
        adminsError
      );
    }

    let assignedAdminName: string | null = null;
    let assignedAdminEmail: string | null = null;

    if (developmentRequest.assigned_admin_id) {
      const assignedAdmin = (admins ?? []).find(
        (admin) =>
          admin.id ===
          developmentRequest.assigned_admin_id
      );

      assignedAdminName =
        assignedAdmin?.name ?? null;

      assignedAdminEmail =
        assignedAdmin?.email ?? null;
    }

    return NextResponse.json({
      request: {
        id: developmentRequest.id,

        title:
          developmentRequest.title ??
          "Development Request",

        description:
          developmentRequest.description ??
          "",

        application:
          developmentRequest.application ??
          developmentRequest.system ??
          null,

        status:
          developmentRequest.status ??
          "pending",

        priority:
          developmentRequest.priority ??
          "normal",

        requested_by_name:
          developmentRequest.requested_by_name ??
          developmentRequest.requester_name ??
          developmentRequest.created_by_name ??
          null,

        requested_by_email:
          developmentRequest.requested_by_email ??
          developmentRequest.requester_email ??
          developmentRequest.created_by_email ??
          null,

        assigned_admin_id:
          developmentRequest.assigned_admin_id ??
          null,

        assigned_admin_name:
          assignedAdminName,

        assigned_admin_email:
          assignedAdminEmail,

        admin_notes:
          developmentRequest.admin_notes ??
          null,

        created_at:
          developmentRequest.created_at,

        updated_at:
          developmentRequest.updated_at ??
          null,

        completed_at:
          developmentRequest.completed_at ??
          null,
      },

      admins: admins ?? [],

      // Leave empty for now until we confirm
      // your actual development request history table.
      history: [],
    });
  } catch (error) {
    console.error(
      "Unexpected Development Request GET error:",
      error
    );

    return errorResponse(
      "Something went wrong while loading the development request.",
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return errorResponse(
        "Development request ID is required.",
        400
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return errorResponse(
        "You must be signed in to access this area.",
        401
      );
    }

    const {
      data: currentAdmin,
      error: adminError,
    } = await supabase
      .from("admin_users")
      .select(`
        id,
        name,
        email,
        role
      `)
      .ilike("email", user.email)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Development Request PATCH admin lookup error:",
        adminError
      );

      return errorResponse(
        "Unable to verify your admin account.",
        500
      );
    }

    if (!currentAdmin) {
      return errorResponse(
        "You do not have permission to update Development Requests.",
        403
      );
    }

    const body = await request
      .json()
      .catch(() => null);

    if (!body) {
      return errorResponse(
        "Invalid request body.",
        400
      );
    }

    const {
      status,
      priority,
      assigned_admin_id,
      admin_notes,
    } = body;

    if (
      status !== undefined &&
      !ALLOWED_STATUSES.includes(
        status as RequestStatus
      )
    ) {
      return errorResponse(
        "Invalid development request status.",
        400
      );
    }

    if (
      priority !== undefined &&
      !ALLOWED_PRIORITIES.includes(
        priority as RequestPriority
      )
    ) {
      return errorResponse(
        "Invalid development request priority.",
        400
      );
    }

    // CORRECT TABLE
    const {
      data: existingRequest,
      error: existingError,
    } = await supabase
      .from("admin_development_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Development Request lookup error:",
        existingError
      );

      return errorResponse(
        "Unable to load this development request.",
        500
      );
    }

    if (!existingRequest) {
      return errorResponse(
        "Development request not found.",
        404
      );
    }

    if (assigned_admin_id) {
      const {
        data: selectedAdmin,
        error: selectedAdminError,
      } = await supabase
        .from("admin_users")
        .select("id, name, email")
        .eq("id", assigned_admin_id)
        .maybeSingle();

      if (selectedAdminError) {
        console.error(
          "Assigned admin validation error:",
          selectedAdminError
        );

        return errorResponse(
          "Unable to validate the selected admin.",
          500
        );
      }

      if (!selectedAdmin) {
        return errorResponse(
          "The selected admin could not be found.",
          400
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      updateData.status = status;

      if (
        status === "completed" &&
        existingRequest.status !== "completed"
      ) {
        updateData.completed_at =
          new Date().toISOString();
      }

      if (
        status !== "completed" &&
        existingRequest.status === "completed"
      ) {
        updateData.completed_at = null;
      }
    }

    if (priority !== undefined) {
      updateData.priority = priority;
    }

    if (assigned_admin_id !== undefined) {
      updateData.assigned_admin_id =
        assigned_admin_id || null;
    }

    if (admin_notes !== undefined) {
      updateData.admin_notes =
        typeof admin_notes === "string" &&
        admin_notes.trim()
          ? admin_notes.trim()
          : null;
    }

    // CORRECT TABLE
    const {
      data: updatedRequest,
      error: updateError,
    } = await supabase
      .from("admin_development_requests")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error(
        "Development Request update error:",
        updateError
      );

      return errorResponse(
        "Unable to update this development request.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Development request updated successfully.",
      request: updatedRequest,
    });
  } catch (error) {
    console.error(
      "Unexpected Development Request PATCH error:",
      error
    );

    return errorResponse(
      "Something went wrong while updating the development request.",
      500
    );
  }
}