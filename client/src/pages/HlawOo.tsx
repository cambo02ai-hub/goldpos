import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FileText, Printer, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type SlipSize = "58" | "80" | "custom";
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);
const weightText = (kyat: number, pae: number, yway: number) =>
  `${formatNumber(kyat)} ကျပ် ${formatNumber(pae)} ပဲ ${formatNumber(yway, 1)} ရွေး`;

const emptyForm = {
  serviceDate: today(),
  customerName: "",
  hlawKyat: "",
  hlawPae: "",
  hlawYway: "",
  tinKyat: "",
  tinPae: "",
  tinHtwe: "",
  serviceFee: "",
  note: "",
};

type FormState = typeof emptyForm;

export default function HlawOo() {
  const { user } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [invoiceRow, setInvoiceRow] = useState<any>(null);
  const utils = trpc.useUtils();
  const query = trpc.shopBook.hlawOo.useQuery(
    { from, to },
    { enabled: Boolean(user) }
  );
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      row =>
        !needle ||
        `${row.customerName} ${row.note ?? ""}`.toLowerCase().includes(needle)
    );
  }, [query.data, search]);
  const reportRows = query.data ?? [];
  const reportTotal = reportRows.reduce(
    (sum, row) => sum + Number(row.serviceFee || 0),
    0
  );
  const dailyReport = useMemo(() => {
    const grouped = new Map<string, { count: number; total: number }>();
    for (const row of reportRows) {
      const current = grouped.get(row.serviceDate) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += Number(row.serviceFee || 0);
      grouped.set(row.serviceDate, current);
    }
    return Array.from(grouped.entries()).sort((a, b) =>
      b[0].localeCompare(a[0])
    );
  }, [reportRows]);
  const no2Preview = calculateNo2(form);
  const createMutation = trpc.shopBook.createHlawOo.useMutation({
    onSuccess: () => {
      toast.success("လှော်အိုးစာရင်း သိမ်းပြီးပါပြီ");
      setForm(previous => ({
        ...emptyForm,
        serviceDate: previous.serviceDate,
      }));
      void utils.shopBook.hlawOo.invalidate();
      void utils.shopBook.journal.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.shopBook.removeHlawOo.useMutation({
    onSuccess: () => {
      toast.success("လှော်အိုးစာရင်း ဖျက်ပြီးပါပြီ");
      void utils.shopBook.hlawOo.invalidate();
      void utils.shopBook.journal.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const update = (key: keyof FormState, value: string) =>
    setForm(previous => ({ ...previous, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.customerName.trim()) return toast.error("အမည် ဖြည့်ပေးပါ");
    if (
      number(form.hlawKyat) + number(form.hlawPae) + number(form.hlawYway) <=
      0
    )
      return toast.error("Hlaw အလေးချိန် ဖြည့်ပေးပါ");
    createMutation.mutate({
      serviceDate: form.serviceDate,
      customerName: form.customerName.trim(),
      hlawKyat: number(form.hlawKyat),
      hlawPae: number(form.hlawPae),
      hlawYway: number(form.hlawYway),
      tinKyat: number(form.tinKyat),
      tinPae: number(form.tinPae),
      tinHtwe: number(form.tinHtwe),
      serviceFee: number(form.serviceFee),
      note: form.note.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-[#17201d] -m-2 p-3 sm:-m-4 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1320px] space-y-5">
        <header className="border-b border-[#e4ebe6] pb-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">
            Hlaw Oo Service Ledger
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            လှော်အိုးစာရင်း
          </h1>
          <p className="mt-1 text-sm text-[#68756d]">
            ဆိုင်စာရင်းအုပ်နှင့် သီးခြားစာရင်း။ မှတ်တမ်းတစ်ကြောင်းစီအတွက်
            ဘောင်ချာ slip ထုတ်နိုင်ပါသည်။
          </p>
        </header>

        <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] bg-white px-4 py-4 sm:px-6">
            <CardTitle className="text-xl">လှော်အိုးစာရင်းအသစ်</CardTitle>
            <p className="text-sm text-[#78867e]">
              No.2 ကို Hlaw × 3 ဖြင့် အလိုအလျောက်တွက်ပြီး Kyoot ကို Tin
              အပေါ်အခြေခံ၍ ပြပါမည်။
            </p>
          </CardHeader>
          <CardContent className="bg-white px-4 py-5 sm:px-6">
            <form
              onSubmit={submit}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Field label="နေ့စွဲ">
                <Input
                  type="date"
                  value={form.serviceDate}
                  onChange={e => update("serviceDate", e.target.value)}
                />
              </Field>
              <Field label="အမည် *">
                <Input
                  autoFocus
                  placeholder="ဥပမာ - ကိုဖိုးထူး"
                  value={form.customerName}
                  onChange={e => update("customerName", e.target.value)}
                />
              </Field>
              <WeightField
                label="Hlaw ကျပ်သား"
                value={form.hlawKyat}
                onChange={v => update("hlawKyat", v)}
              />
              <WeightField
                label="Hlaw ပဲ"
                value={form.hlawPae}
                max="15"
                onChange={v => update("hlawPae", v)}
              />
              <WeightField
                label="Hlaw ရွေး"
                value={form.hlawYway}
                max="7.5"
                step="0.1"
                onChange={v => update("hlawYway", v)}
              />
              <div className="rounded-lg border border-[#dcebe0] bg-[#f4faf5] p-3 text-sm text-[#286442]">
                <p className="text-xs text-[#68756d]">
                  No.2 အလိုအလျောက် (Hlaw × 3)
                </p>
                <b>
                  {weightText(no2Preview.kyat, no2Preview.pae, no2Preview.yway)}
                </b>
              </div>
              <WeightField
                label="Tin ကျပ်သား"
                value={form.tinKyat}
                onChange={v => update("tinKyat", v)}
              />
              <WeightField
                label="Tin ပဲ"
                value={form.tinPae}
                max="15"
                onChange={v => update("tinPae", v)}
              />
              <WeightField
                label="Tin Htwe"
                value={form.tinHtwe}
                max="7.5"
                step="0.1"
                onChange={v => update("tinHtwe", v)}
              />
              <Field label="လှော်ခ (ကျပ်)">
                <Input
                  type="number"
                  min="0"
                  value={form.serviceFee}
                  onChange={e => update("serviceFee", e.target.value)}
                />
              </Field>
              <Field label="မှတ်ချက်">
                <Input
                  value={form.note}
                  onChange={e => update("note", e.target.value)}
                />
              </Field>
              <div className="flex items-end lg:col-span-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="h-10 w-full bg-[#276044] text-white hover:bg-[#1f5038]"
                >
                  {createMutation.isPending
                    ? "သိမ်းနေပါသည်…"
                    : "လှော်အိုးစာရင်း သိမ်းမည်"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
          <CardHeader className="gap-3 border-b border-[#edf1ee] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <CardTitle className="text-xl">လှော်အိုးမှတ်တမ်း</CardTitle>
              <p className="mt-1 text-sm text-[#78867e]">
                {rows.length} စာရင်း · ရက်စွဲအလိုက် စစ်ထုတ်ထားသည်
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
              <Input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aa79f]" />
                <Input
                  className="pl-9"
                  placeholder="အမည်ရှာရန်"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#f8faf8] text-left text-xs text-[#748079]">
                  <tr>
                    <th className="px-4 py-3">နေ့စွဲ</th>
                    <th className="px-3 py-3">အမည်</th>
                    <th className="px-3 py-3">Hlaw</th>
                    <th className="px-3 py-3">No.2</th>
                    <th className="px-3 py-3">Tin</th>
                    <th className="px-3 py-3 text-right">Kyoot</th>
                    <th className="px-3 py-3 text-right">လှော်ခ</th>
                    <th className="px-4 py-3 text-right">လုပ်ဆောင်ချက်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ee]">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-[#fbfdfb]">
                      <td className="px-4 py-3">{row.serviceDate}</td>
                      <td className="px-3 py-3 font-semibold">
                        {row.customerName}
                      </td>
                      <td className="px-3 py-3">
                        {weightText(row.hlawKyat, row.hlawPae, row.hlawYway)}
                      </td>
                      <td className="px-3 py-3">
                        {weightText(row.no2Kyat, row.no2Pae, row.no2Yway)}
                      </td>
                      <td className="px-3 py-3">
                        {weightText(row.tinKyat, row.tinPae, row.tinHtwe)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.kyoot === null
                          ? "—"
                          : Number(row.kyoot).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {formatNumber(Number(row.serviceFee))} ကျပ်
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInvoiceRow(row)}
                            className="text-[#276044]"
                          >
                            <FileText className="mr-1.5 h-4 w-4" />
                            Slip
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                deleteMutation.mutate({ id: row.id })
                              }
                              aria-label="မှတ်တမ်းဖျက်ရန်"
                            >
                              <Trash2 className="h-4 w-4 text-[#9a5b4d]" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-[#89968d]"
                      >
                        စာရင်းမတွေ့ပါ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[#dfe8e2] shadow-sm print:shadow-none">
          <CardHeader className="gap-3 border-b border-[#edf1ee] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <CardTitle className="text-xl">လှော်ခ ဝင်ငွေ Report</CardTitle>
              <p className="mt-1 text-sm text-[#78867e]">
                {from} မှ {to} အထိ · လှော်ခပေါင်းချုပ်
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const date = today();
                  setFrom(date);
                  setTo(date);
                }}
              >
                ယနေ့
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFrom(monthStart());
                  setTo(today());
                }}
              >
                ယခုလ
              </Button>
              <Button type="button" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" /> Report Print
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-5 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ReportMetric
                label="လှော်ခ စုစုပေါင်း"
                value={`${formatNumber(reportTotal)} ကျပ်`}
              />
              <ReportMetric
                label="ဝန်ဆောင်မှုစာရင်း"
                value={`${formatNumber(reportRows.length)} ကြောင်း`}
              />
              <ReportMetric
                label="ပျမ်းမျှလှော်ခ"
                value={`${formatNumber(reportRows.length ? Math.round(reportTotal / reportRows.length) : 0)} ကျပ်`}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-[#f8faf8] text-left text-xs text-[#748079]">
                  <tr>
                    <th className="px-4 py-3">နေ့စွဲ</th>
                    <th className="px-3 py-3 text-right">စာရင်းအရေအတွက်</th>
                    <th className="px-4 py-3 text-right">လှော်ခပေါင်းချုပ်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ee]">
                  {dailyReport.map(([date, summary]) => (
                    <tr key={date}>
                      <td className="px-4 py-3">{date}</td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(summary.count)} ကြောင်း
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatNumber(summary.total)} ကျပ်
                      </td>
                    </tr>
                  ))}
                  {dailyReport.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center text-[#89968d]"
                      >
                        Report စာရင်းမရှိပါ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <HlawInvoiceDialog
          row={invoiceRow}
          onClose={() => setInvoiceRow(null)}
        />
      </div>
    </div>
  );
}

function number(value: string) {
  return Number(value || 0);
}
function calculateNo2(form: FormState) {
  const total =
    (number(form.hlawKyat) +
      number(form.hlawPae) / 16 +
      number(form.hlawYway) / 128) *
    3;
  const kyat = Math.floor(total);
  const paeRaw = (total - kyat) * 16;
  const pae = Math.floor(paeRaw);
  return { kyat, pae, yway: Math.round((paeRaw - pae) * 8 * 10) / 10 };
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-[#53645b]">
      <span>{label}</span>
      {children}
    </label>
  );
}
function WeightField({
  label,
  value,
  onChange,
  max,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  step?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min="0"
        max={max}
        step={step}
        value={value}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
      />
    </Field>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5ebe7] bg-[#f8fbf9] p-3 sm:p-4">
      <p className="text-xs font-semibold text-[#748079]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#1f5e3a]">{value}</p>
    </div>
  );
}

function HlawInvoiceDialog({
  row,
  onClose,
}: {
  row: any;
  onClose: () => void;
}) {
  const [slipSize, setSlipSize] = useState<SlipSize>(() =>
    typeof window !== "undefined"
      ? (window.localStorage.getItem("gold-hlaw-slip-size") as SlipSize) || "58"
      : "58"
  );
  const [customLength, setCustomLength] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("gold-hlaw-slip-length") || "180"
      : "180"
  );
  if (!row) return null;
  const print = () => {
    const length = Math.min(500, Math.max(50, Number(customLength) || 180));
    window.localStorage.setItem("gold-hlaw-slip-size", slipSize);
    window.localStorage.setItem("gold-hlaw-slip-length", String(length));
    const style = document.createElement("style");
    const width = slipSize === "80" ? 80 : 58;
    style.textContent = `@media print { @page { size: ${width}mm ${slipSize === "custom" ? length : 180}mm; margin: 0; } }`;
    document.head.appendChild(style);
    window.print();
    window.setTimeout(() => style.remove(), 1000);
  };
  return (
    <Dialog open={Boolean(row)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[720px] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[#e5ece7] bg-[#f7fbf8] px-5 py-4 no-print">
          <div>
            <p className="font-bold text-[#1e3025]">လှော်အိုး ဘောင်ချာ</p>
            <p className="text-xs text-[#78867e]">
              Slip ကို ကြိုကြည့်ပြီး print ထုတ်ပါ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={slipSize}
              onChange={e => setSlipSize(e.target.value as SlipSize)}
              className="h-9 rounded-md border bg-white px-2 text-sm"
            >
              <option value="58">58mm</option>
              <option value="80">80mm</option>
              <option value="custom">စိတ်ကြိုက်</option>
            </select>
            {slipSize === "custom" && (
              <label className="flex items-center gap-1 text-xs text-[#53645b]">
                အရှည်
                <Input
                  className="h-9 w-20 bg-white"
                  type="number"
                  min="50"
                  max="500"
                  step="1"
                  value={customLength}
                  onChange={e => setCustomLength(e.target.value)}
                  aria-label="Slip အရှည် (mm)"
                />
                mm
              </label>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          className={`mx-auto my-5 bg-white p-5 text-sm text-[#17201d] ${slipSize === "58" ? "w-[58mm]" : "w-[80mm]"}`}
          style={
            slipSize === "custom"
              ? {
                  minHeight: `${Math.min(500, Math.max(50, Number(customLength) || 180))}mm`,
                }
              : undefined
          }
        >
          <div className="text-center">
            <p className="mt-1 font-semibold">လှော်အိုး ဝန်ဆောင်မှုဘောင်ချာ</p>
            <p className="text-xs">{row.serviceDate}</p>
          </div>
          <div className="my-3 border-t border-dashed border-[#9aa79f]" />
          <SlipLine label="အမည်" value={row.customerName} />
          <SlipLine
            label="Hlaw"
            value={weightText(row.hlawKyat, row.hlawPae, row.hlawYway)}
          />
          <SlipLine
            label="No.2"
            value={weightText(row.no2Kyat, row.no2Pae, row.no2Yway)}
          />
          <SlipLine
            label="Tin"
            value={weightText(row.tinKyat, row.tinPae, row.tinHtwe)}
          />
          <SlipLine
            label="Kyoot"
            value={row.kyoot === null ? "—" : Number(row.kyoot).toFixed(2)}
          />
          <div className="my-3 border-t border-dashed border-[#9aa79f]" />
          <SlipLine
            label="လှော်ခ"
            value={`${formatNumber(Number(row.serviceFee))} ကျပ်`}
            strong
          />
          {row.note && <p className="mt-3 text-xs">မှတ်ချက်: {row.note}</p>}
          <p className="mt-5 text-center text-xs">ကျေးဇူးတင်ပါသည်။</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#edf1ee] bg-white px-5 py-4 no-print">
          <Button variant="outline" onClick={onClose}>
            ပိတ်မည်
          </Button>
          <Button
            onClick={print}
            className="bg-[#276044] text-white hover:bg-[#1f5038]"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print ထုတ်မည်
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function SlipLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 py-1 ${strong ? "font-bold" : ""}`}
    >
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
