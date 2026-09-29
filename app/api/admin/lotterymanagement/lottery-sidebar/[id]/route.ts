import { NextRequest } from "next/server";
import { deleteSidebarItem } from "../delete-item";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return deleteSidebarItem(request, id, body);
}
