import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

let printInProgress = false;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}

async function renderSlipCanvas(element: HTMLElement) {
  await document.fonts?.ready;
  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
    useCORS: true,
    logging: false,
    imageTimeout: 0,
    scrollX: 0,
    scrollY: -window.scrollY,
  });
}

export function printSlipAsPdf(element: HTMLElement, title: string) {
  if (printInProgress) return;
  printInProgress = true;
  document.querySelectorAll(".invoice-print-target").forEach(target => {
    target.classList.remove("invoice-print-target");
  });
  element.classList.add("invoice-print-target");
  const previousTitle = document.title;
  document.title = title;
  const cleanup = () => {
    printInProgress = false;
    element.classList.remove("invoice-print-target");
    document.title = previousTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    window.print();
    window.setTimeout(cleanup, 10000);
  }, 40);
}

export async function exportSlipImage(
  element: HTMLElement,
  filename: string,
  shareTitle: string
) {
  const canvas = await renderSlipCanvas(element);
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Slip image ဖန်တီး၍ မရပါ");

  const file = new File([blob], filename, { type: "image/png" });
  const canShare =
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });
  if (canShare) {
    await navigator.share({ title: shareTitle, files: [file] });
    return "shared" as const;
  }

  downloadBlob(blob, filename);
  return "downloaded" as const;
}

export async function exportSlipPdf(
  element: HTMLElement,
  filename: string,
  shareTitle: string,
  widthMm: number,
  heightMm: number
) {
  const canvas = await renderSlipCanvas(element);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true,
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);
  const blob = pdf.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  const canShare =
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });
  if (canShare) {
    await navigator.share({ title: shareTitle, files: [file] });
    return "shared" as const;
  }

  downloadBlob(blob, filename);
  return "downloaded" as const;
}
