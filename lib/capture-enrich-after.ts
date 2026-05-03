import { after } from "next/server";
import {
  markCaptureEnrichmentFailure,
  runCaptureEnrichment,
} from "@/lib/run-capture-enrichment";

/** Fire-and-forget enrichment after a 201 response (same pattern as POST /api/captures). */
export function scheduleCaptureEnrichmentAfterResponse(captureId: string) {
  try {
    after(() => {
      void (async () => {
        try {
          const result = await runCaptureEnrichment(captureId, {
            skipMarkProcessing: true,
          });
          if (!result.ok) {
            console.error("[auto-enrich] finished with failure", {
              captureId,
              error: result.error,
              httpStatus: result.httpStatus,
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("ENRICH_AFTER_ERROR_NON_BLOCKING", {
            captureId,
            stage: "auto_enrich_inner",
            message,
          });
          try {
            await markCaptureEnrichmentFailure(captureId, message);
          } catch (markErr) {
            console.error("ENRICH_AFTER_ERROR_NON_BLOCKING", {
              captureId,
              stage: "mark_failure_after_enrich_throw",
              message:
                markErr instanceof Error ? markErr.message : String(markErr),
            });
          }
        }
      })();
    });
  } catch (scheduleErr) {
    console.error("ENRICH_AFTER_ERROR_NON_BLOCKING", {
      stage: "after_schedule",
      message:
        scheduleErr instanceof Error
          ? scheduleErr.message
          : String(scheduleErr),
    });
  }
}
