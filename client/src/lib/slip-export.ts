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

type BluetoothCharacteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue: (value: Uint8Array) => Promise<void>;
};

type BluetoothDevice = {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothGattServer>;
  };
};

type BluetoothGattServer = {
  getPrimaryServices: () => Promise<
    Array<{
      getCharacteristics: () => Promise<BluetoothCharacteristic[]>;
    }>
  >;
};

function getWritableCharacteristic(
  services: Array<{
    getCharacteristics: () => Promise<BluetoothCharacteristic[]>;
  }>
) {
  return (async () => {
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find(
        characteristic =>
          characteristic.properties.writeWithoutResponse ||
          characteristic.properties.write
      );
      if (writable) return writable;
    }
    return null;
  })();
}

async function writeChunks(
  characteristic: BluetoothCharacteristic,
  data: Uint8Array
) {
  for (let offset = 0; offset < data.length; offset += 180) {
    await characteristic.writeValue(data.slice(offset, offset + 180));
  }
}

function canvasToEscPos(canvas: HTMLCanvasElement, widthDots: number) {
  const heightDots = Math.max(
    1,
    Math.round((canvas.height / canvas.width) * widthDots)
  );
  const resized = document.createElement("canvas");
  resized.width = widthDots;
  resized.height = heightDots;
  const context = resized.getContext("2d");
  if (!context) throw new Error("Printer image ပြင်ဆင်၍ မရပါ");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, widthDots, heightDots);
  context.drawImage(canvas, 0, 0, widthDots, heightDots);
  const pixels = context.getImageData(0, 0, widthDots, heightDots).data;
  const bytesPerRow = Math.ceil(widthDots / 8);
  const raster = new Uint8Array(bytesPerRow * heightDots);
  for (let y = 0; y < heightDots; y++) {
    for (let x = 0; x < widthDots; x++) {
      const pixel = (y * widthDots + x) * 4;
      const grayscale =
        pixels[pixel] * 0.299 +
        pixels[pixel + 1] * 0.587 +
        pixels[pixel + 2] * 0.114;
      if (grayscale < 180) {
        raster[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> x % 8;
      }
    }
  }
  const header = new Uint8Array([
    0x1d,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    heightDots & 0xff,
    (heightDots >> 8) & 0xff,
  ]);
  const cutCommand = new Uint8Array([0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const output = new Uint8Array(
    2 + header.length + raster.length + cutCommand.length
  );
  output.set([0x1b, 0x40], 0);
  output.set(header, 2);
  output.set(raster, 2 + header.length);
  output.set(cutCommand, 2 + header.length + raster.length);
  return output;
}

export async function printSlipToBluetooth(
  element: HTMLElement,
  widthMm: number
) {
  const bluetooth = (
    navigator as Navigator & {
      bluetooth?: {
        requestDevice: (options: {
          acceptAllDevices: boolean;
          optionalServices: string[];
        }) => Promise<BluetoothDevice>;
      };
    }
  ).bluetooth;
  if (!bluetooth) {
    throw new Error("Windows Chrome BLE Bluetooth ကို မထောက်ပံ့ပါ");
  }
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "000018f0-0000-1000-8000-00805f9b34fb",
      "0000ffe0-0000-1000-8000-00805f9b34fb",
      "0000ffe5-0000-1000-8000-00805f9b34fb",
      "0000fff0-0000-1000-8000-00805f9b34fb",
    ],
  });
  if (!device.gatt) throw new Error("ဒီ printer တွင် GATT မရပါ");
  const server: BluetoothGattServer = device.gatt.connected
    ? (device.gatt as unknown as BluetoothGattServer)
    : await device.gatt.connect();
  const services = await server.getPrimaryServices();
  const characteristic = await getWritableCharacteristic(services);
  if (!characteristic) {
    throw new Error("Writable ESC/POS Bluetooth characteristic မတွေ့ပါ");
  }
  const canvas = await renderSlipCanvas(element);
  const widthDots = widthMm >= 80 ? 576 : 384;
  await writeChunks(characteristic, canvasToEscPos(canvas, widthDots));
  return device.name || "Bluetooth POS printer";
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
