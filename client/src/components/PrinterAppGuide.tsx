import { Button } from "@/components/ui/button";
import { printSlipToBluetooth } from "@/lib/slip-export";
import { Bluetooth, ExternalLink, Monitor, Share2, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

type SlipElementRef = { current: HTMLElement | null };

const printerApps = [
  {
    id: "thermer",
    name: "Thermer – Bluetooth Thermal Printer",
    description:
      "PDF, image နှင့် ESC/POS receipt များအတွက် စမ်းသုံးရန် သင့်တော်ပါသည်။",
    url: "https://apps.apple.com/us/app/bluetooth-thermal-printer-app/id1599863946",
  },
  {
    id: "mobile-print-util",
    name: "Mobile Print Util",
    description:
      "iPad မှ image, multilingual text နှင့် ESC/POS print လုပ်နိုင်ပါသည်။",
    url: "https://apps.apple.com/app/mobile-print-util/id1517535160",
  },
  {
    id: "express-thermal-print",
    name: "Express Thermal Print",
    description:
      "Receipt နှင့် image ကို Bluetooth thermal printer သို့ ထုတ်နိုင်ပါသည်။",
    url: "https://apps.apple.com/us/app/express-thermal-print/id1449743356",
  },
  {
    id: "easy-pos-print",
    name: "Easy POS Print",
    description:
      "ESC/POS printer များကို Bluetooth/Wi-Fi/USB ဖြင့် ချိတ်နိုင်ပါသည်။",
    url: "https://apps.apple.com/us/app/easy-pos-print/id1638971353",
  },
] as const;

export function PrinterAppGuide({
  elementRef,
  widthMm = 58,
}: {
  elementRef?: SlipElementRef;
  widthMm?: number;
}) {
  const [selectedId, setSelectedId] = useState(() =>
    typeof window === "undefined"
      ? printerApps[0].id
      : window.localStorage.getItem("goldpos-printer-app") || printerApps[0].id
  );
  const [connecting, setConnecting] = useState(false);
  const selected =
    printerApps.find(app => app.id === selectedId) || printerApps[0];

  useEffect(() => {
    window.localStorage.setItem("goldpos-printer-app", selected.id);
  }, [selected.id]);

  const directBluetoothPrint = async () => {
    if (!elementRef?.current) {
      window.alert("Slip ကို အရင်ဖွင့်ပြီး ထပ်မံစမ်းပါ။");
      return;
    }
    setConnecting(true);
    try {
      const printerName = await printSlipToBluetooth(
        elementRef.current,
        widthMm
      );
      window.alert(`${printerName} သို့ Slip ထုတ်ပြီးပါပြီ။`);
    } catch (error) {
      if ((error as DOMException)?.name !== "NotFoundError") {
        window.alert(
          `${error instanceof Error ? error.message : "Bluetooth print မအောင်မြင်ပါ"}\n\nClassic Bluetooth printer ဖြစ်ပါက Windows မှာ PDF/Image ကို download လုပ်ပြီး printer app သို့မဟုတ် Windows printer driver မှတစ်ဆင့် ထုတ်ပါ။`
        );
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <section className="no-print rounded-xl border border-[#d7e7dc] bg-[#f5fbf7] p-3 text-xs text-[#53645b]">
      <div className="flex items-start gap-2">
        <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-[#276044]" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[#1f5e3a]">
            Bluetooth POS Printer Workflow
          </p>
          <p className="mt-1">
            iPad တွင် Image / Share သုံးပါ။ Printer app မပေါ်ပါက Save PNG ဖြင့်
            Files ထဲသိမ်းပြီး printer app ထဲမှ Import Image လုပ်ပါ။ Windows
            Chrome တွင် BLE printer ဖြစ်ပါက တိုက်ရိုက်ချိတ်နိုင်ပြီး Classic
            Bluetooth printer ဖြစ်ပါက Exact PDF/Image ကို download လုပ်ပြီး
            Windows printer app/driver မှတစ်ဆင့် ထုတ်ပါ။
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#cfe0d4] bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Monitor className="h-4 w-4 text-[#276044]" />
          <p className="font-bold text-[#1f5e3a]">
            Windows Chrome — Direct BLE Print
          </p>
          <Button
            type="button"
            size="sm"
            onClick={directBluetoothPrint}
            disabled={connecting}
            className="ml-auto bg-[#276044] text-white hover:bg-[#1f5038]"
          >
            <Bluetooth className="mr-1.5 h-3.5 w-3.5" />
            {connecting ? "ချိတ်ဆက်နေသည်…" : "Bluetooth ချိတ်ပြီး Print"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-[#6d7c73]">
          BLE ESC/POS printer များအတွက်သာ Chrome မှ တိုက်ရိုက်အလုပ်လုပ်ပါမည်။
          Browser က printer ရွေးရန် permission ပြပါက printer ကိုရွေးပါ။
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="printer-app" className="font-semibold text-[#53645b]">
          iPad Printer app
        </label>
        <select
          id="printer-app"
          value={selected.id}
          onChange={event => setSelectedId(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-[#cfe0d4] bg-white px-2 py-2 text-xs font-semibold text-[#25322b]"
        >
          {printerApps.map(app => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(selected.url, "_blank", "noopener,noreferrer")
          }
          className="border-[#bcd5c3] bg-white text-[#276044]"
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          App Store
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-[#6d7c73]">{selected.description}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <WorkflowStep
          number="1"
          title="Image / Save PNG"
          detail="Share မပေါ်ပါက PNG ကို Files ထဲသိမ်းပါ"
        />
        <WorkflowStep
          number="2"
          title="Connect printer"
          detail="BLE direct သို့မဟုတ် Windows driver/app ကို သုံးပါ"
        />
        <WorkflowStep
          number="3"
          title="Actual size"
          detail="100% / No scaling ဖြင့် ထုတ်ပါ"
        />
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-[#6d7c73]">
        <Wifi className="h-3 w-3" /> Windows မှာ Classic Bluetooth POS printer
        များအတွက် printer driver သို့မဟုတ် Print Assistant app လိုအပ်နိုင်ပါသည်။
      </p>
    </section>
  );
}

function WorkflowStep({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#dcebe1] bg-white p-2">
      <p className="font-bold text-[#276044]">
        {number}. {title}
      </p>
      <p className="mt-0.5 text-[11px]">{detail}</p>
    </div>
  );
}
