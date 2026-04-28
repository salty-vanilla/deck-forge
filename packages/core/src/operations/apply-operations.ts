import type { PresentationIR } from "#/index.js";
import { addChart } from "#/operations/handlers/add-chart.js";
import { addImage } from "#/operations/handlers/add-image.js";
import { addSlide } from "#/operations/handlers/add-slide.js";
import { addTable } from "#/operations/handlers/add-table.js";
import { addText } from "#/operations/handlers/add-text.js";
import { applyTheme } from "#/operations/handlers/apply-theme.js";
import { attachAsset } from "#/operations/handlers/attach-asset.js";
import { deleteElement } from "#/operations/handlers/delete-element.js";
import { moveSlide } from "#/operations/handlers/move-slide.js";
import { removeSlide } from "#/operations/handlers/remove-slide.js";
import { setSlideLayout } from "#/operations/handlers/set-slide-layout.js";
import { updateChartData } from "#/operations/handlers/update-chart-data.js";
import { updateText } from "#/operations/handlers/update-text.js";
import type { PresentationOperation } from "#/operations/types.js";
import { appendOperationRecord, clonePresentation } from "#/operations/utils.js";

export async function applyOperations(
  presentation: PresentationIR,
  operations: PresentationOperation[],
): Promise<PresentationIR> {
  const next = clonePresentation(presentation);

  for (const operation of operations) {
    try {
      switch (operation.type) {
        case "add_slide":
          addSlide(next, operation);
          break;
        case "remove_slide":
          removeSlide(next, operation);
          break;
        case "move_slide":
          moveSlide(next, operation);
          break;
        case "set_slide_layout":
          setSlideLayout(next, operation);
          break;
        case "add_text":
          addText(next, operation);
          break;
        case "update_text":
          updateText(next, operation);
          break;
        case "delete_element":
          deleteElement(next, operation);
          break;
        case "add_image":
          addImage(next, operation);
          break;
        case "add_table":
          addTable(next, operation);
          break;
        case "add_chart":
          addChart(next, operation);
          break;
        case "update_chart_data":
          updateChartData(next, operation);
          break;
        case "attach_asset":
          attachAsset(next, operation);
          break;
        case "apply_theme":
          applyTheme(next, operation);
          break;
        default:
          throw new Error(`Unsupported operation type: ${(operation as { type: string }).type}`);
      }

      appendOperationRecord(next, operation, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendOperationRecord(next, operation, "failed", message);
      throw new Error(`Operation failed (${operation.type}): ${message}`);
    }
  }

  return next;
}
