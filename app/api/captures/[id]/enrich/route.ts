import { describeCaptureEnrichBranch } from "@/lib/captures-enrich-pipeline";
import { runCaptureEnrichment } from "@/lib/run-capture-enrichment";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const { data: preRow } = await supabase
      .from("captures")
      .select("id, raw_text, url, image_url, capture_type, status")
      .eq("id", id)
      .single();
    if (preRow) {
      console.info(
        "ENRICH_ROUTE_PIPELINE",
        describeCaptureEnrichBranch({
          id: preRow.id,
          url: preRow.url,
          raw_text: preRow.raw_text,
          image_url: preRow.image_url,
        })
      );
    }
    console.info("[enrich-route] POST", { captureId: id });
    const result = await runCaptureEnrichment(id);

    if (!result.ok) {
      console.error("[enrich-route] failed", {
        captureId: id,
        error: result.error,
        httpStatus: result.httpStatus,
      });
      return NextResponse.json(
        { error: result.error },
        { status: result.httpStatus }
      );
    }

    return NextResponse.json({ capture: result.capture });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[enrich-route] unexpected", { captureId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
