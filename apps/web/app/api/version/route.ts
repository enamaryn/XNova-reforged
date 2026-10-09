import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/build-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildInfo, {
    headers: { "Cache-Control": "no-store" },
  });
}
