import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { goldWeightParts } from "@shared/shop-calculations";
import {
  CalendarDays,
  CheckCircle2,
  Plus,
  RefreshCcw,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);
const formatWeight = (value: number) => {
  const parts = goldWeightParts(value);
  return `${formatNumber(parts.kyat)} ကျပ် ${formatNumber(parts.pae)} ပဲ ${formatNumber(parts.yway, 1)} ရွေး`;
};
type PaymentMethod = "cash" | "bank" | "kbzpay" | "wavepay" | "other";
const emptyForm = {
  tradeDate: today(),
  transactionType: "sell" as "sell" | "buy",
  partyName: "",
  itemName: "",
  kyat: "",
  pae: "",
  yway: "",
  rate: "",
  paymentMethod: "cash" as PaymentMethod,
  paidAmount: "",
  note: "",
};
type FormState = typeof emptyForm;

export default function NewEntry() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showOptional, setShowOptional] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [lastRates, setLastRates] = useState<Record<"sell" | "buy", string>>(
    () => {
      if (typeof window === "undefined") return { sell: "", buy: "" };
      return {
        sell: window.localStorage.getItem("goldpos-last-rate-sell") ?? "",
        buy: window.localStorage.getItem("goldpos-last-rate-buy") ?? "",
      };
    }
  );
  const utils = trpc.useUtils();
  const customerQuery = trpc.ledger.list.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 60000,
  });
  const dailyQuery = trpc.shopBook.daily.useQuery(
    { date: form.tradeDate },
    { enabled: Boolean(user), refetchOnWindowFocus: true }
  );
  const customerNames = Array.from(
    new Set(
      (customerQuery.data ?? [])
        .map(row => row.partyName.trim())
        .filter(Boolean)
    )
  ).slice(0, 100);
  const createMutation = trpc.ledger.create.useMutation({
    onSuccess: () => {
      toast.success("စာရင်းသွင်းပြီးပါပြီ");
      setForm({
        ...emptyForm,
        tradeDate: form.tradeDate,
        transactionType: form.transactionType,
        rate: form.rate,
      });
      setShowPayment(false);
      window.localStorage.setItem(
        `goldpos-last-rate-${form.transactionType}`,
        form.rate
      );
      setLastRates(previous => ({
        ...previous,
        [form.transactionType]: form.rate,
      }));
      void utils.ledger.list.invalidate();
      void utils.ledger.summary.invalidate();
      void dailyQuery.refetch();
    },
    onError: error =>
      toast.error(error.message || "စာရင်းသွင်းရာတွင် အမှားရှိပါသည်"),
  });
  const update = (key: keyof FormState, value: string) =>
    setForm(previous => ({ ...previous, [key]: value }));
  const weight =
    Number(form.kyat || 0) +
    Number(form.pae || 0) / 16 +
    Number(form.yway || 0) / 128;
  const calculatedAmount = Math.round(weight * Number(form.rate || 0));
  const paidAmount =
    form.paidAmount === "" ? calculatedAmount : Number(form.paidAmount || 0);
  const isCredit = paidAmount < calculatedAmount;
  const currentStock =
    dailyQuery.data?.stockBalance?.expectedClosingWeight ?? 0;
  const entryWeight = weight;
  const stockAfterEntry =
    currentStock +
    (form.transactionType === "buy" ? entryWeight : -entryWeight);
  const updateType = (value: string) => {
    const transactionType = value as "sell" | "buy";
    setForm(previous => ({
      ...previous,
      transactionType,
      rate: previous.rate || lastRates[transactionType],
    }));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.partyName.trim()) return toast.error("အမည် ဖြည့်ပေးပါ");
    if (!form.rate || Number(form.rate) <= 0)
      return toast.error("Rate ဖြည့်ပေးပါ");
    if (calculatedAmount <= 0)
      return toast.error("အလေးချိန်ကို မှန်ကန်စွာ ဖြည့်ပေးပါ");
    if (Number(form.pae || 0) > 15 || Number(form.yway || 0) > 127)
      return toast.error("ပဲနှင့် ရွေးပမာဏကို မှန်ကန်စွာ ဖြည့်ပေးပါ");
    if (paidAmount < 0 || paidAmount > calculatedAmount)
      return toast.error("လက်ခံ/ပေးချေပြီးငွေသည် စုစုပေါင်းထက် မကျော်ရပါ");
    createMutation.mutate({
      tradeDate: form.tradeDate,
      transactionType: form.transactionType,
      partyName: form.partyName.trim(),
      itemName: form.itemName.trim() || undefined,
      kyat: Number(form.kyat || 0),
      pae: Number(form.pae || 0),
      yway: Number(form.yway || 0),
      rate: Number(form.rate),
      paymentMethod: form.paymentMethod,
      paidAmount,
      note: form.note.trim() || undefined,
    });
    window.localStorage.setItem(
      `goldpos-last-rate-${form.transactionType}`,
      form.rate
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-[#17201d] -m-2 p-3 sm:-m-4 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[980px] space-y-5">
        <header className="border-b border-[#e4ebe6] pb-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">
            New transaction
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            စာရင်းအသစ် ထည့်ရန်
          </h1>
          <p className="mt-1 text-sm text-[#68756d]">
            ဝယ်/ရောင်း အချက်အလက်နှင့် ငွေပေးချေမှုအခြေအနေကို တစ်ခါတည်း
            မှတ်တမ်းတင်ပါ။
          </p>
        </header>
        <Card className="overflow-hidden rounded-2xl border-[#dfe8e2] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] bg-white px-4 py-5 sm:px-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">အရောင်းအဝယ် အချက်အလက်</CardTitle>
                <p className="mt-1 text-sm text-[#78867e]">
                  အမည်၊ အလေးချိန်နှင့် Rate ဖြည့်ပြီး စာရင်းသွင်းပါ။ Amount
                  နှင့် Stock လက်ကျန်ကို အလိုအလျောက်တွက်ပေးပါမည်။
                </p>
              </div>
              <div className="rounded-xl bg-[#e8f5eb] p-3 text-[#2c6e49]">
                <Plus className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="bg-white px-4 py-5 sm:px-7">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[160px_190px_1fr_1fr]">
                <div className="space-y-1.5">
                  <Label>နေ့စွဲ</Label>
                  <Input
                    type="date"
                    value={form.tradeDate}
                    onChange={e => update("tradeDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>အမျိုးအစား</Label>
                  <Tabs value={form.transactionType} onValueChange={updateType}>
                    <TabsList className="grid w-full grid-cols-2 bg-[#eef4ef]">
                      <TabsTrigger
                        value="sell"
                        className="data-[state=active]:bg-[#fff3e2] data-[state=active]:text-[#a15f13]"
                      >
                        ရောင်း
                      </TabsTrigger>
                      <TabsTrigger
                        value="buy"
                        className="data-[state=active]:bg-[#e8f5eb] data-[state=active]:text-[#2c6e49]"
                      >
                        ဝယ်
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    ဝယ်သူ / ရောင်းသူ အမည်{" "}
                    <span className="text-[#b84b3e]">*</span>
                  </Label>
                  <Input
                    autoFocus
                    placeholder="ဥပမာ - ကိုဖိုးထူး"
                    list="goldpos-customer-names"
                    value={form.partyName}
                    onChange={e => update("partyName", e.target.value)}
                  />
                  <datalist id="goldpos-customer-names">
                    {customerNames.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>ပစ္စည်းအမည်</Label>
                  <Input
                    placeholder="ဥပမာ - ရွှေလက်ကောက် / လက်စွပ်"
                    value={form.itemName}
                    onChange={e => update("itemName", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">
                  အလေးချိန် <span className="text-[#b84b3e]">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <WeightInput
                    label="ကျပ်"
                    value={form.kyat}
                    onChange={value => update("kyat", value)}
                  />
                  <WeightInput
                    label="ပဲ"
                    value={form.pae}
                    max="15"
                    onChange={value => update("pae", value)}
                  />
                  <WeightInput
                    label="ရွေး"
                    value={form.yway}
                    max="127"
                    onChange={value => update("yway", value)}
                    step="0.1"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Rate (ကျပ်) <span className="text-[#b84b3e]">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="10,000,000"
                    value={form.rate}
                    onChange={e => update("rate", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update("rate", lastRates[form.transactionType])
                    }
                    disabled={!lastRates[form.transactionType]}
                    className="mt-1 text-left text-xs font-semibold text-[#2c6e49] hover:underline disabled:cursor-not-allowed disabled:text-[#9aa79f] disabled:no-underline"
                  >
                    {lastRates[form.transactionType]
                      ? `ယခင် Rate ကိုသုံးမည် (${formatNumber(Number(lastRates[form.transactionType]))})`
                      : "ယခင် Rate မရှိသေးပါ"}
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#dcebe0] bg-[#f4faf5] px-4 py-3">
                  <div>
                    <p className="text-xs text-[#68756d]">
                      တွက်ချက်ထားသော Amount
                    </p>
                    <p className="text-xl font-bold text-[#1f5e3a]">
                      {formatNumber(calculatedAmount)} ကျပ်
                    </p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-[#63a878]" />
                </div>
              </div>
              <div
                className={`rounded-xl border p-4 ${stockAfterEntry < 0 ? "border-red-300 bg-red-50" : "border-[#dcebe0] bg-[#f4faf5]"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#68756d]">
                      စာရင်းသွင်းပြီးနောက် ခန့်မှန်းရွှေလက်ကျန်
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold ${stockAfterEntry < 0 ? "text-[#b84b3e]" : "text-[#1f5e3a]"}`}
                    >
                      {formatWeight(stockAfterEntry)}
                    </p>
                  </div>
                  <span className="text-xs text-[#78867e]">
                    {dailyQuery.isLoading
                      ? "လက်ကျန်တွက်နေပါသည်…"
                      : "ဝယ်/ရောင်းထည့်ပြီးနောက်"}
                  </span>
                </div>
                {stockAfterEntry < 0 && (
                  <p className="mt-2 text-xs font-semibold text-[#b84b3e]">
                    သတိ: ဤရောင်းစာရင်းပြီးနောက် ရွှေလက်ကျန် အနုတ်ဖြစ်နေပါသည်။
                  </p>
                )}
              </div>
              <section className="rounded-xl border border-[#e0e9e2] bg-[#fbfdfb] p-4">
                <button
                  type="button"
                  onClick={() => setShowPayment(value => !value)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="font-semibold text-[#25322b]">
                      ငွေပေးချေမှု အခြေအနေ
                    </p>
                    <p className="mt-0.5 text-xs text-[#78867e]">
                      {showPayment
                        ? "အကြွေး သို့မဟုတ် တစ်စိတ်တစ်ပိုင်းပေးချေမှုကို ထည့်ပါ။"
                        : "အပြည့်ပေးချေထားသည်ဟု သတ်မှတ်ထားပါသည်။ အကြွေးရှိမှ ဖွင့်ပါ။"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-[#2c6e49]">
                    {showPayment ? "ဖျောက်မည်" : "အကြွေးထည့်မည်"}
                  </span>
                </button>
                {showPayment && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>ငွေလက်ခံ/ပေးချေနည်း</Label>
                      <select
                        value={form.paymentMethod}
                        onChange={e => update("paymentMethod", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="cash">ငွေသား</option>
                        <option value="bank">ဘဏ်</option>
                        <option value="kbzpay">KBZPay</option>
                        <option value="wavepay">Wave Money</option>
                        <option value="other">အခြား</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>လက်ခံ/ပေးချေပြီးငွေ</Label>
                      <Input
                        type="number"
                        min="0"
                        max={calculatedAmount}
                        placeholder={formatNumber(calculatedAmount)}
                        value={form.paidAmount}
                        onChange={e => update("paidAmount", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <div
                        className={`w-full rounded-lg px-3 py-2.5 text-sm font-semibold ${isCredit ? "bg-[#fff4e8] text-[#a15f13]" : "bg-[#e8f5eb] text-[#2c6e49]"}`}
                      >
                        {isCredit
                          ? `အကြွေးကျန် ${formatNumber(calculatedAmount - paidAmount)} ကျပ်`
                          : "အပြည့်ပေးချေပြီး"}
                      </div>
                    </div>
                  </div>
                )}
              </section>
              <div className="border-t border-[#edf1ee] pt-4">
                <button
                  type="button"
                  onClick={() => setShowOptional(value => !value)}
                  className="flex items-center gap-2 text-sm font-medium text-[#53645b] hover:text-[#276044]"
                >
                  <Settings2 className="h-4 w-4" /> Optional details{" "}
                  {showOptional ? "ဖျောက်မည်" : "ထည့်မည်"}
                </button>
                {showOptional && (
                  <div className="mt-3">
                    <div className="space-y-1.5">
                      <Label>မှတ်ချက်</Label>
                      <Input
                        placeholder="မှတ်ချက်ထည့်ရန်"
                        value={form.note}
                        onChange={e => update("note", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-12 w-full rounded-xl bg-[#276044] text-white hover:bg-[#1f5038] sm:w-auto sm:px-10"
              >
                {createMutation.isPending ? (
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                စာရင်းသွင်းမည်
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="flex items-center gap-2 text-xs text-[#8a958e]">
          <CalendarDays className="h-3.5 w-3.5" /> အကြွေးကျန်များကို ငွေစာရင်း
          Tab မှ တစ်ကြိမ်ချင်း ပြန်လည်ရှင်းလင်းနိုင်ပါသည်။
        </p>
      </div>
    </div>
  );
}

function WeightInput({
  label,
  value,
  onChange,
  step = "1",
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  max?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min="0"
        max={max}
        step={step}
        placeholder="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pr-10"
      />
      <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[#89968d]">
        {label}
      </span>
    </div>
  );
}
