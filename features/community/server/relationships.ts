import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data, error } = await session.supabase
    .from("user_relationships")
    .select("target_user_id, relationship_type, created_at")
    .eq("actor_user_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: "relationships_unavailable", message: "Your block and mute settings could not be loaded." },
      { status: 502 },
    );
  }
  return NextResponse.json({ relationships: data });
}

export async function POST(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;
  const parsed = await readJsonBody(request, 1000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "invalid_relationship", message: "A user and relationship type are required." }, { status: 400 });
  }

  const input = parsed.value as Record<string, unknown>;
  if (
    typeof input.targetUserId !== "string" ||
    !uuidPattern.test(input.targetUserId) ||
    input.targetUserId === session.user.id ||
    (input.relationshipType !== "block" && input.relationshipType !== "mute")
  ) {
    return NextResponse.json({ error: "invalid_relationship", message: "Choose another user and a valid relationship." }, { status: 400 });
  }

  const { error } = await session.supabase.from("user_relationships").upsert(
    {
      actor_user_id: session.user.id,
      target_user_id: input.targetUserId,
      relationship_type: input.relationshipType,
    },
    { onConflict: "actor_user_id,target_user_id,relationship_type" },
  );
  if (error) {
    return NextResponse.json({ error: "relationship_failed", message: "This user setting could not be saved." }, { status: 502 });
  }
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;
  const params = new URL(request.url).searchParams;
  const targetUserId = params.get("targetUserId");
  const relationshipType = params.get("relationshipType");
  if (
    !targetUserId ||
    !uuidPattern.test(targetUserId) ||
    targetUserId === session.user.id ||
    (relationshipType !== "block" && relationshipType !== "mute")
  ) {
    return NextResponse.json({ error: "invalid_relationship", message: "Choose a valid user and relationship." }, { status: 400 });
  }

  const { error } = await session.supabase
    .from("user_relationships")
    .delete()
    .eq("actor_user_id", session.user.id)
    .eq("target_user_id", targetUserId)
    .eq("relationship_type", relationshipType);
  if (error) {
    return NextResponse.json({ error: "relationship_failed", message: "This user setting could not be removed." }, { status: 502 });
  }
  return NextResponse.json({ removed: true });
}
