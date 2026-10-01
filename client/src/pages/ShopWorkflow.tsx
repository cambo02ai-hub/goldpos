import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Coins,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  calculateStockBalance,
  estimateDailyGoldProfit,
  goldWeightParts,
} from "@shared/shop-calculations";

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);
const formatGoldWeight = (weight: number) => {
  const parts = goldWeightParts(Math.max(0, weight));
  return `${formatNumber(parts.kyat)} ကျပ် ${formatNumber(parts.pae)} ပဲ ${formatNumber(parts.yway, 1)} ရွေး`;
};
const monthStart = (month: string) => `${month}-01`;
const monthEnd = (month: string) =>
  `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
const inputNumber = (value: string) => (value === "" ? 0 : Number(value));
const fieldClass = "mt-1";

function NumberField({
  label,
  value,
  onChange,
  min = "0",
  step = "1",
  max,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  step?: string;
  max?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-[#53645b]">
      {label}
      <Input
        className={fieldClass}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "green",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "green" | "orange" | "blue" | "purple";
}) {
  const styles = {
    green: "bg-[#e9f5ed] text-[#286442]",
    orange: "bg-[#fff2e6] text-[#a25b12]",
    blue: "bg-[#eaf2fa] text-[#35678d]",
    purple: "bg-[#f1edfa] text-[#7055a2]",
  };
  return (
    <div className="rounded-xl border border-[#e5ebe7] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-[#748079]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#17201d]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#89968d]">{hint}</p>}
      <span
        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[tone]}`}
      >
        စာရင်း
      </span>
    </div>
  );
}

export default function ShopWorkflow() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(monthStart(today().slice(0, 7)));
  const [to, setTo] = useState(today());
  const [closingForm, setClosingForm] = useState({
    openingCash: "0",
    openingGoldKyat: "0",
    openingGoldPae: "0",
    openingGoldYway: "0",
    openingGoldValue: "0",
    closingGoldKyat: "0",
    closingGoldPae: "0",
    closingGoldYway: "0",
    closingGoldRate: "10000000",
    countedCash: "",
    note: "",
  });
  const [journalForm, setJournalForm] = useState({
    entryDate: today(),
    side: "debit" as "debit" | "credit",
    accountCode: "1001",
    details: "",
    kyat: "",
    pae: "",
    yway: "",
    rate: "",
    price: "",
    amount: "",
  });
  const [hlawForm, setHlawForm] = useState({
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
  });
  const [leaveForm, setLeaveForm] = useState({
    leaveDate: today(),
    employeeName: "",
    leaveType: "leave" as "leave" | "absent" | "late" | "other",
    dayUnits: "1",
    note: "",
  });
  const accountsQuery = trpc.shopBook.accounts.useQuery();
  const dailyQuery = trpc.shopBook.daily.useQuery(
    { date },
    { refetchOnWindowFocus: true }
  );
  const journalQuery = trpc.shopBook.journal.useQuery({ from, to });
  const hlawQuery = trpc.shopBook.hlawOo.useQuery({ from, to });
  const leaveQuery = trpc.shopBook.leaves.useQuery({
    from: monthStart(date.slice(0, 7)),
    to: monthEnd(date.slice(0, 7)),
  });
  const daily = dailyQuery.data;
  useEffect(() => {
    if (!daily) return;
    const close = daily.closing;
    const calculated =
      daily.stockBalance ??
      calculateStockBalance({
        opening: {
          kyat: daily.opening.goldKyat,
          pae: daily.opening.goldPae,
          yway: daily.opening.goldYway,
        },
        boughtWeight: daily.boughtWeight,
        soldWeight: daily.soldWeight,
      });
    const carryGold = calculated.expectedClosing;
    setClosingForm({
      openingCash: String(daily.opening.cash),
      openingGoldKyat: String(daily.opening.goldKyat),
      openingGoldPae: String(daily.opening.goldPae),
      openingGoldYway: String(daily.opening.goldYway),
      openingGoldValue: String(daily.opening.goldValue),
      closingGoldKyat: String(close?.goldKyat ?? carryGold.kyat),
      closingGoldPae: String(close?.goldPae ?? carryGold.pae),
      closingGoldYway: String(close?.goldYway ?? carryGold.yway),
      closingGoldRate: String(close?.goldRate || 10000000),
      countedCash:
        close?.countedCash === null || close?.countedCash === undefined
          ? ""
          : String(close.countedCash),
      note: close?.note ?? "",
    });
  }, [daily]);
  const journalMutation = trpc.shopBook.createJournal.useMutation({
    onSuccess: () => {
      toast.success("Dr/Cr စာရင်းသွင်းပြီးပါပြီ");
      setJournalForm(previous => ({
        ...previous,
        details: "",
        amount: "",
        kyat: "",
        pae: "",
        yway: "",
        rate: "",
        price: "",
      }));
      void utils.shopBook.journal.invalidate();
      void utils.shopBook.daily.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const closeMutation = trpc.shopBook.saveDaily.useMutation({
    onSuccess: () => {
      toast.success("နေ့ပိတ်စာရင်း သိမ်းပြီးပါပြီ");
      void utils.shopBook.daily.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const hlawMutation = trpc.shopBook.createHlawOo.useMutation({
    onSuccess: () => {
      toast.success("လှော်အိုးစာရင်း သိမ်းပြီးပါပြီ");
      setHlawForm(previous => ({
        ...previous,
        customerName: "",
        hlawKyat: "",
        hlawPae: "",
        hlawYway: "",
        tinKyat: "",
        tinPae: "",
        tinHtwe: "",
        serviceFee: "",
        note: "",
      }));
      void utils.shopBook.hlawOo.invalidate();
      void utils.shopBook.journal.invalidate();
      void utils.shopBook.daily.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const leaveMutation = trpc.shopBook.createLeave.useMutation({
    onSuccess: () => {
      toast.success("ခွင့်မှတ်တမ်း သိမ်းပြီးပါပြီ");
      setLeaveForm(previous => ({
        ...previous,
        employeeName: "",
        dayUnits: "1",
        note: "",
      }));
      void utils.shopBook.leaves.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteJournal = trpc.shopBook.removeJournal.useMutation({
    onSuccess: () => {
      void utils.shopBook.journal.invalidate();
      void utils.shopBook.daily.invalidate();
      toast.success("စာရင်းဖျက်ပြီးပါပြီ");
    },
    onError: error => toast.error(error.message),
  });
  const deleteHlaw = trpc.shopBook.removeHlawOo.useMutation({
    onSuccess: () => {
      void utils.shopBook.hlawOo.invalidate();
      void utils.shopBook.journal.invalidate();
      void utils.shopBook.daily.invalidate();
      toast.success("လှော်အိုးစာရင်းဖျက်ပြီးပါပြီ");
    },
    onError: error => toast.error(error.message),
  });
  const deleteLeave = trpc.shopBook.removeLeave.useMutation({
    onSuccess: () => {
      void utils.shopBook.leaves.invalidate();
      toast.success("ခွင့်မှတ်တမ်းဖျက်ပြီးပါပြီ");
    },
    onError: error => toast.error(error.message),
  });
  const accounts = accountsQuery.data ?? [];
  const allowedAccounts = accounts.filter(
    account => account.side === journalForm.side
  );
  const journalRows = journalQuery.data ?? [];
  const hlawRows = hlawQuery.data ?? [];
  const leaveRows = leaveQuery.data ?? [];
  const leaveTotals = useMemo(
    () =>
      leaveRows.reduce<Record<string, number>>((out, row) => {
        out[row.employeeName] =
          (out[row.employeeName] ?? 0) + Number(row.dayUnits);
        return out;
      }, {}),
    [leaveRows]
  );
  const stockBalance = daily?.stockBalance;
  const openingGoldIsCarryForward = daily?.openingSource === "previous_closing";
  const closeValue = Math.round(
    (inputNumber(closingForm.closingGoldKyat) +
      inputNumber(closingForm.closingGoldPae) / 16 +
      inputNumber(closingForm.closingGoldYway) / 128) *
      inputNumber(closingForm.closingGoldRate)
  );
  const profitEstimate = daily
    ? estimateDailyGoldProfit({
        sales: daily.sales,
        purchases: daily.purchases,
        openingValue: inputNumber(closingForm.openingGoldValue),
        closingWeight: {
          kyat: inputNumber(closingForm.closingGoldKyat),
          pae: inputNumber(closingForm.closingGoldPae),
          yway: inputNumber(closingForm.closingGoldYway),
        },
        closingRate: inputNumber(closingForm.closingGoldRate),
      })
    : 0;
  const submitDaily = (event: FormEvent) => {
    event.preventDefault();
    closeMutation.mutate({
      closingDate: date,
      openingCash: inputNumber(closingForm.openingCash),
      openingGoldKyat: inputNumber(closingForm.openingGoldKyat),
      openingGoldPae: inputNumber(closingForm.openingGoldPae),
      openingGoldYway: inputNumber(closingForm.openingGoldYway),
      openingGoldValue: inputNumber(closingForm.openingGoldValue),
      closingGoldKyat: inputNumber(closingForm.closingGoldKyat),
      closingGoldPae: inputNumber(closingForm.closingGoldPae),
      closingGoldYway: inputNumber(closingForm.closingGoldYway),
      closingGoldRate: inputNumber(closingForm.closingGoldRate),
      countedCash:
        closingForm.countedCash === ""
          ? null
          : inputNumber(closingForm.countedCash),
      note: closingForm.note.trim() || null,
    });
  };
  const submitJournal = (event: FormEvent) => {
    event.preventDefault();
    if (!journalForm.details.trim())
      return toast.error("အကြောင်းအရာ ဖြည့်ပေးပါ");
    if (inputNumber(journalForm.amount) <= 0)
      return toast.error("ငွေပမာဏ ဖြည့်ပေးပါ");
    journalMutation.mutate({
      entryDate: journalForm.entryDate,
      side: journalForm.side,
      accountCode: journalForm.accountCode,
      details: journalForm.details.trim(),
      kyat: inputNumber(journalForm.kyat),
      pae: inputNumber(journalForm.pae),
      yway: inputNumber(journalForm.yway),
      rate: inputNumber(journalForm.rate),
      price: inputNumber(journalForm.price),
      amount: inputNumber(journalForm.amount),
    });
  };
  const submitHlaw = (event: FormEvent) => {
    event.preventDefault();
    if (!hlawForm.customerName.trim()) return toast.error("အမည် ဖြည့်ပေးပါ");
    hlawMutation.mutate({
      serviceDate: hlawForm.serviceDate,
      customerName: hlawForm.customerName.trim(),
      hlawKyat: inputNumber(hlawForm.hlawKyat),
      hlawPae: inputNumber(hlawForm.hlawPae),
      hlawYway: inputNumber(hlawForm.hlawYway),
      tinKyat: inputNumber(hlawForm.tinKyat),
      tinPae: inputNumber(hlawForm.tinPae),
      tinHtwe: inputNumber(hlawForm.tinHtwe),
      serviceFee: inputNumber(hlawForm.serviceFee),
      note: hlawForm.note.trim() || undefined,
    });
  };
  const submitLeave = (event: FormEvent) => {
    event.preventDefault();
    if (!leaveForm.employeeName.trim())
      return toast.error("ဝန်ထမ်းအမည် ဖြည့်ပေးပါ");
    leaveMutation.mutate({
      leaveDate: leaveForm.leaveDate,
      employeeName: leaveForm.employeeName.trim(),
      leaveType: leaveForm.leaveType,
      dayUnits: inputNumber(leaveForm.dayUnits),
      note: leaveForm.note.trim() || undefined,
    });
  };
  const updateClose = (key: keyof typeof closingForm, value: string) =>
    setClosingForm(previous => ({ ...previous, [key]: value }));

  return (
    <div className="min-h-screen -m-2 bg-[#f7f9f8] p-3 text-[#17201d] sm:-m-4 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="border-b border-[#e4ebe6] pb-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">
            Shop operations · September workbook workflow
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ဆိုင်စာရင်းအုပ်
          </h1>
          <p className="mt-1 text-sm text-[#68756d]">
            နေ့စဉ်ရွှေစာရင်း၊ Dr/Cr account code နှင့် ဝန်ထမ်းခွင့် workflow ကို
            စီမံပါ။ လှော်အိုးစာရင်းကို သီးခြား menu မှ စီမံပါ။
          </p>
        </header>
        <Tabs defaultValue="daily" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="h-auto min-w-max bg-[#eaf1ec] p-1">
              <TabsTrigger value="daily" className="px-3 py-2">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                နေ့ပိတ်စာရင်း
              </TabsTrigger>
              <TabsTrigger value="journal" className="px-3 py-2">
                <BookOpenCheck className="mr-1.5 h-4 w-4" />
                Dr / Cr စာရင်း
              </TabsTrigger>
              <TabsTrigger value="leave" className="px-3 py-2">
                <Users className="mr-1.5 h-4 w-4" />
                ခွင့်မှတ်တမ်း
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="daily" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-[#dfe8e2] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">နေ့စဉ်ရောင်း/ဝယ်နှင့် လက်ကျန်</p>
                <p className="text-xs text-[#7b8981]">
                  အရောင်း/အဝယ်သည် POS မှ အလိုအလျောက်ရယူပြီး၊ နေ့ပိတ်တွင်
                  ရွှေလက်ကျန်နှင့် ငွေသားကို အတည်ပြုပါ။
                </p>
              </div>
              <Input
                aria-label="စာရင်းနေ့စွဲ"
                type="date"
                className="w-full sm:w-[170px]"
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric
                label="အရောင်းစုစုပေါင်း"
                value={`${formatNumber(daily?.sales ?? 0)} ကျပ်`}
                hint={`${formatNumber(daily?.soldWeight ?? 0)} ကျပ်သား`}
                tone="orange"
              />
              <Metric
                label="အဝယ်စုစုပေါင်း"
                value={`${formatNumber(daily?.purchases ?? 0)} ကျပ်`}
                hint={`${formatNumber(daily?.boughtWeight ?? 0)} ကျပ်သား`}
                tone="green"
              />
              <Metric
                label="စာရင်းအရ ငွေလက်ကျန်"
                value={`${formatNumber(daily?.expectedCash ?? 0)} ကျပ်`}
                hint={`Dr ${formatNumber(daily?.debit ?? 0)} − Cr ${formatNumber(daily?.credit ?? 0)}`}
                tone="blue"
              />
              <Metric
                label="ရွှေစာရင်းအမြတ် ခန့်မှန်း"
                value={`${formatNumber(profitEstimate)} ကျပ်`}
                hint="ရောင်း − အဝယ် + လက်ကျန်တန်ဖိုး ပြောင်းလဲမှု"
                tone="purple"
              />
            </div>
            <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
              <CardHeader className="border-b border-[#edf1ee]">
                <CardTitle className="text-lg">ရွှေလက်ကျန်စာရင်း</CardTitle>
                <p className="text-sm text-[#78867e]">
                  အဖွင့်လက်ကျန် + ဝယ် − ရောင်း = မျှော်မှန်းပိတ်လက်ကျန်
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric
                    label="အဖွင့်လက်ကျန်"
                    value={
                      stockBalance
                        ? formatGoldWeight(stockBalance.openingWeight)
                        : "0 ကျပ် 0 ပဲ 0 ရွေး"
                    }
                    hint="ယခင်နေ့ပိတ်လက်ကျန်မှ"
                    tone="blue"
                  />
                  <Metric
                    label="ယနေ့ဝယ်"
                    value={
                      stockBalance
                        ? formatGoldWeight(stockBalance.boughtWeight)
                        : "0 ကျပ် 0 ပဲ 0 ရွေး"
                    }
                    hint="POS အဝယ်စုစုပေါင်း"
                    tone="green"
                  />
                  <Metric
                    label="ယနေ့ရောင်း"
                    value={
                      stockBalance
                        ? formatGoldWeight(stockBalance.soldWeight)
                        : "0 ကျပ် 0 ပဲ 0 ရွေး"
                    }
                    hint="POS အရောင်းစုစုပေါင်း"
                    tone="orange"
                  />
                  <Metric
                    label="မျှော်မှန်းပိတ်လက်ကျန်"
                    value={
                      stockBalance
                        ? formatGoldWeight(stockBalance.expectedClosingWeight)
                        : "0 ကျပ် 0 ပဲ 0 ရွေး"
                    }
                    hint="အလိုအလျောက်တွက်ချက်မှု"
                    tone="purple"
                  />
                </div>
                {daily?.closing && stockBalance && (
                  <div className="mt-4 rounded-lg border border-[#e5ebe7] bg-[#f8fbf9] p-3 text-sm text-[#53645b]">
                    လက်တွေ့ပိတ်လက်ကျန်:{" "}
                    <b>
                      {formatGoldWeight(
                        daily.closing.goldKyat +
                          daily.closing.goldPae / 16 +
                          daily.closing.goldYway / 128
                      )}
                    </b>{" "}
                    · မျှော်မှန်းနှင့် ကွာခြားချက်ကို စစ်ဆေးပြီးမှ နေ့ပိတ်ပါ။
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
              <CardHeader className="border-b border-[#edf1ee]">
                <CardTitle className="text-lg">နေ့ကုန်စာရင်းပိတ်</CardTitle>
                <p className="text-sm text-[#78867e]">
                  နောက်နေ့၏ အဖွင့်ငွေ/ရွှေလက်ကျန်ကို ယခင်ပိတ်စာရင်းမှ
                  ဆက်ယူပါသည်။ လက်တွေ့ရေတွက်ထားသောငွေနှင့် စနစ်တွက်ငွေကွာဟချက်ကို
                  အောက်တွင်ပြပါမည်။
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {dailyQuery.isLoading ? (
                  <p className="py-6 text-center text-sm text-[#78867e]">
                    စာရင်းတွက်နေပါသည်…
                  </p>
                ) : (
                  <form onSubmit={submitDaily} className="space-y-5">
                    <section>
                      <h3 className="mb-3 text-sm font-bold text-[#2c6e49]">
                        အဖွင့်လက်ကျန်
                      </h3>
                      <div
                        className={`mb-3 rounded-lg border p-3 text-sm ${
                          openingGoldIsCarryForward
                            ? "border-[#cfe3d4] bg-[#f1f9f3] text-[#286442]"
                            : "border-[#f1ddbd] bg-[#fff9ef] text-[#8b5a19]"
                        }`}
                      >
                        {openingGoldIsCarryForward ? (
                          <>
                            <b>အလိုအလျောက်ဆက်ယူထားသည်။</b> ဤရက်၏ Opening Gold
                            သည် ယခင်နေ့ Closing Gold မှ formula
                            ဖြင့်ယူထားခြင်းဖြစ်ပြီး ပြင်ဆင်၍မရပါ။
                            {daily?.previousClosingDate && (
                              <> Source: {daily.previousClosingDate}</>
                            )}
                          </>
                        ) : (
                          <>
                            <b>ပထမဆုံးစာရင်းနေ့ ဖြစ်ပါသည်။</b> ဆိုင်၏
                            စတင်ရွှေလက်ကျန် (Opening Gold) ကို ကျပ်၊ ပဲ၊
                            ရွေးနှင့် တန်ဖိုးအတိုင်း ကိုယ်တိုင် ဖြည့်ပါ။
                            နောက်ရက်များတွင် ယခင်နေ့ Closing မှ အလိုအလျောက်
                            ဆက်ယူပါမည်။
                          </>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <NumberField
                          label="အဖွင့်ငွေ (ကျပ်)"
                          value={closingForm.openingCash}
                          onChange={v => updateClose("openingCash", v)}
                        />
                        <NumberField
                          label="အဖွင့်ရွှေ ကျပ်သား"
                          value={closingForm.openingGoldKyat}
                          disabled={openingGoldIsCarryForward}
                          onChange={v => updateClose("openingGoldKyat", v)}
                        />
                        <NumberField
                          label="ပဲ"
                          value={closingForm.openingGoldPae}
                          max="15"
                          step="1"
                          disabled={openingGoldIsCarryForward}
                          onChange={v => updateClose("openingGoldPae", v)}
                        />
                        <NumberField
                          label="ရွေး"
                          value={closingForm.openingGoldYway}
                          max="127"
                          step="0.1"
                          disabled={openingGoldIsCarryForward}
                          onChange={v => updateClose("openingGoldYway", v)}
                        />
                        <NumberField
                          label="အဖွင့်ရွှေ တန်ဖိုး (ကျပ်)"
                          value={closingForm.openingGoldValue}
                          disabled={openingGoldIsCarryForward}
                          onChange={v => updateClose("openingGoldValue", v)}
                        />
                      </div>
                    </section>
                    <section>
                      <h3 className="mb-3 text-sm font-bold text-[#2c6e49]">
                        ပိတ်လက်ကျန်နှင့် ငွေစစ်ဆေးခြင်း
                      </h3>
                      <div className="mb-3 rounded-lg border border-[#cfe3d4] bg-[#f1f9f3] p-3 text-sm text-[#286442]">
                        <b>ပိတ်ရွှေလက်ကျန်ကို ကိုယ်တိုင်ထည့်ရန် မလိုပါ။</b>
                        ဝယ်/ရောင်းစာရင်းကို အခြေခံပြီး system က
                        အလိုအလျောက်တွက်ကာ သိမ်းပါမည်။
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <NumberField
                          label="တွက်ချက်ထားသော ပိတ်ရွှေ ကျပ်သား"
                          value={closingForm.closingGoldKyat}
                          disabled
                          onChange={v => updateClose("closingGoldKyat", v)}
                        />
                        <NumberField
                          label="တွက်ချက်ထားသော ပဲ"
                          value={closingForm.closingGoldPae}
                          max="15"
                          step="1"
                          disabled
                          onChange={v => updateClose("closingGoldPae", v)}
                        />
                        <NumberField
                          label="တွက်ချက်ထားသော ရွေး"
                          value={closingForm.closingGoldYway}
                          max="127"
                          step="0.1"
                          disabled
                          onChange={v => updateClose("closingGoldYway", v)}
                        />
                        <NumberField
                          label="ပိတ်ချိန် ရွှေ Rate"
                          value={closingForm.closingGoldRate}
                          onChange={v => updateClose("closingGoldRate", v)}
                        />
                        <NumberField
                          label="လက်တွေ့ရေတွက်ငွေ (optional)"
                          value={closingForm.countedCash}
                          onChange={v => updateClose("countedCash", v)}
                        />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-[#f6f9f7] p-3 text-sm">
                          ပိတ်ရွှေတန်ဖိုး:{" "}
                          <b>{formatNumber(closeValue)} ကျပ်</b> ·
                          ခန့်မှန်းစာအုပ်အမြတ်:{" "}
                          <b>{formatNumber(profitEstimate)} ကျပ်</b>
                        </div>
                        <label className="text-sm font-medium text-[#53645b]">
                          မှတ်ချက်
                          <Input
                            className="mt-1"
                            value={closingForm.note}
                            onChange={event =>
                              updateClose("note", event.target.value)
                            }
                            maxLength={500}
                          />
                        </label>
                      </div>
                      {daily?.cashVariance !== null &&
                        daily?.cashVariance !== undefined && (
                          <p className="mt-3 rounded-lg bg-[#fff3e7] p-3 text-sm text-[#9c5a12]">
                            လက်တွေ့ငွေနှင့် စာရင်းကွာခြားချက်:{" "}
                            <b>{formatNumber(daily.cashVariance)} ကျပ်</b>
                          </p>
                        )}
                    </section>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={closeMutation.isPending}
                        className="bg-[#2c6e49] hover:bg-[#245a3c]"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {daily?.isClosed
                          ? "ပြန်တွက်ပြီး စာရင်းသိမ်းရန်"
                          : "အလိုအလျောက်တွက်ပြီး စာရင်းပိတ်ရန်"}
                      </Button>
                      <span className="text-xs text-[#89968d]">
                        အမြတ်က ခန့်မှန်းတန်ဖိုးဖြစ်ပြီး စတင်ရွှေတန်ဖိုးနှင့်
                        ပိတ်နှုန်းအပေါ် မူတည်သည်။
                      </span>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="journal" className="space-y-4">
            <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">
                  Dr / Cr မှတ်တမ်းထည့်ရန်
                </CardTitle>
                <p className="text-sm text-[#78867e]">
                  Excel ရှိ 1001–1009 (Dr) နှင့် 2001–2013 (Cr) account code
                  များကို အသုံးပြုပါ။ POS ရောင်း/ဝယ်၊ အကြွေးရှင်းနှင့်
                  ငွေစာရင်းအချို့ကို အလိုအလျောက်ချိတ်ထားသည်။
                </p>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={submitJournal}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <label className="text-sm font-medium text-[#53645b]">
                    နေ့စွဲ
                    <Input
                      className={fieldClass}
                      type="date"
                      value={journalForm.entryDate}
                      onChange={e =>
                        setJournalForm({
                          ...journalForm,
                          entryDate: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#53645b]">
                    စာရင်းဘက်
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={journalForm.side}
                      onChange={e =>
                        setJournalForm({
                          ...journalForm,
                          side: e.target.value as "debit" | "credit",
                          accountCode:
                            e.target.value === "debit" ? "1001" : "2001",
                        })
                      }
                    >
                      <option value="debit">Dr · အဝင်/Dr</option>
                      <option value="credit">Cr · အထွက်/Cr</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[#53645b]">
                    Account Code
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={journalForm.accountCode}
                      onChange={e =>
                        setJournalForm({
                          ...journalForm,
                          accountCode: e.target.value,
                        })
                      }
                    >
                      {allowedAccounts.map(a => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[#53645b]">
                    အကြောင်းအရာ
                    <Input
                      className={fieldClass}
                      value={journalForm.details}
                      onChange={e =>
                        setJournalForm({
                          ...journalForm,
                          details: e.target.value,
                        })
                      }
                      maxLength={255}
                    />
                  </label>
                  <NumberField
                    label="ကျပ်သား"
                    value={journalForm.kyat}
                    onChange={v => setJournalForm({ ...journalForm, kyat: v })}
                  />
                  <NumberField
                    label="ပဲ"
                    value={journalForm.pae}
                    max="15"
                    onChange={v => setJournalForm({ ...journalForm, pae: v })}
                  />
                  <NumberField
                    label="ရွေး"
                    value={journalForm.yway}
                    max="127"
                    step="0.1"
                    onChange={v => setJournalForm({ ...journalForm, yway: v })}
                  />
                  <NumberField
                    label="Rate"
                    value={journalForm.rate}
                    onChange={v => setJournalForm({ ...journalForm, rate: v })}
                  />
                  <NumberField
                    label="Price (ကျပ်)"
                    value={journalForm.price}
                    onChange={v => setJournalForm({ ...journalForm, price: v })}
                  />
                  <NumberField
                    label="စာရင်းငွေ (ကျပ်)"
                    value={journalForm.amount}
                    onChange={v =>
                      setJournalForm({ ...journalForm, amount: v })
                    }
                  />
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={journalMutation.isPending}
                      className="w-full bg-[#2c6e49] hover:bg-[#245a3c]"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      စာရင်းထည့်ရန်
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
              <CardHeader className="gap-3 border-b border-[#edf1ee] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">နေ့စဉ် Dr/Cr စာရင်း</CardTitle>
                  <p className="text-sm text-[#78867e]">
                    စာရင်းအရ: Dr{" "}
                    {formatNumber(
                      journalRows
                        .filter(row => row.side === "debit")
                        .reduce((n, row) => n + Number(row.amount), 0)
                    )}{" "}
                    · Cr{" "}
                    {formatNumber(
                      journalRows
                        .filter(row => row.side === "credit")
                        .reduce((n, row) => n + Number(row.amount), 0)
                    )}{" "}
                    ကျပ်
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    aria-label="စာရင်းမှစ"
                    className="w-[145px]"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                  />
                  <Input
                    type="date"
                    aria-label="စာရင်းအထိ"
                    className="w-[145px]"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="bg-[#f8faf8] text-left text-xs text-[#748079]">
                      <tr>
                        <th className="px-4 py-3">နေ့စွဲ</th>
                        <th className="px-3 py-3">ဘက်</th>
                        <th className="px-3 py-3">Code / အကြောင်းအရာ</th>
                        <th className="px-3 py-3 text-right">အလေးချိန်</th>
                        <th className="px-3 py-3 text-right">Rate</th>
                        <th className="px-3 py-3 text-right">Amount</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1ee]">
                      {journalRows.map(row => (
                        <tr key={row.id}>
                          <td className="px-4 py-3">{row.entryDate}</td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                row.side === "debit"
                                  ? "text-[#2c6e49]"
                                  : "text-[#a15f13]"
                              }
                            >
                              {row.side === "debit" ? "Dr" : "Cr"}
                            </span>
                          </td>
                          <td className="max-w-[300px] px-3 py-3">
                            <b>{row.accountCode}</b> · {row.details}
                            {row.sourceType && (
                              <span className="ml-2 text-[10px] text-[#88958d]">
                                POS link
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {row.kyat || row.pae || row.yway
                              ? `${row.kyat}-${row.pae}-${row.yway}`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {row.rate ? formatNumber(row.rate) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {formatNumber(Number(row.amount))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!row.sourceType && user?.role === "admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  deleteJournal.mutate({ id: row.id })
                                }
                                aria-label="စာရင်းဖျက်ရန်"
                              >
                                <Trash2 className="h-4 w-4 text-[#9a5b4d]" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {journalRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
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
          </TabsContent>
          <TabsContent value="leave" className="space-y-4">
            <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">
                  ဝန်ထမ်း ခွင့် / ပျက်ရက် မှတ်တမ်း
                </CardTitle>
                <p className="text-sm text-[#78867e]">
                  Excel ထဲက လစဉ်ဝန်ထမ်းတန်းစီစာရင်းကို နေ့စွဲနှင့်
                  ခွင့်ယူသည့်အမျိုးအစား၊ ရက်အချိုးဖြင့် မှတ်တမ်းတင်ပါ။
                </p>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={submitLeave}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <label className="text-sm font-medium text-[#53645b]">
                    နေ့စွဲ
                    <Input
                      className={fieldClass}
                      type="date"
                      value={leaveForm.leaveDate}
                      onChange={e =>
                        setLeaveForm({
                          ...leaveForm,
                          leaveDate: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#53645b]">
                    ဝန်ထမ်းအမည်
                    <Input
                      className={fieldClass}
                      value={leaveForm.employeeName}
                      onChange={e =>
                        setLeaveForm({
                          ...leaveForm,
                          employeeName: e.target.value,
                        })
                      }
                      maxLength={255}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#53645b]">
                    အမျိုးအစား
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={leaveForm.leaveType}
                      onChange={e =>
                        setLeaveForm({
                          ...leaveForm,
                          leaveType: e.target
                            .value as typeof leaveForm.leaveType,
                        })
                      }
                    >
                      <option value="leave">ခွင့်ယူ</option>
                      <option value="absent">ခွင့်ပျက်/ပျက်ကွက်</option>
                      <option value="late">နောက်ကျ</option>
                      <option value="other">အခြား</option>
                    </select>
                  </label>
                  <NumberField
                    label="ရက်အချိုး (0.5=ခွဲရက်)"
                    value={leaveForm.dayUnits}
                    min="0.01"
                    max="1"
                    step="0.25"
                    onChange={v => setLeaveForm({ ...leaveForm, dayUnits: v })}
                  />
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={leaveMutation.isPending}
                      className="w-full bg-[#2c6e49] hover:bg-[#245a3c]"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      ခွင့်မှတ်တမ်းထည့်ရန်
                    </Button>
                  </div>
                  <label className="text-sm font-medium text-[#53645b] sm:col-span-2 lg:col-span-5">
                    မှတ်ချက်
                    <Input
                      className={fieldClass}
                      value={leaveForm.note}
                      onChange={e =>
                        setLeaveForm({ ...leaveForm, note: e.target.value })
                      }
                    />
                  </label>
                </form>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b border-[#edf1ee]">
                <div>
                  <CardTitle className="text-lg">လစဉ်ခွင့်မှတ်တမ်း</CardTitle>
                  <p className="text-sm text-[#78867e]">
                    အမည်အလိုက် စုစုပေါင်း ခွင့်/ပျက်ရက်
                  </p>
                </div>
                <Input
                  type="month"
                  className="w-[165px]"
                  value={date.slice(0, 7)}
                  onChange={e => setDate(`${e.target.value}-01`)}
                />
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[660px] text-sm">
                    <thead className="bg-[#f8faf8] text-left text-xs text-[#748079]">
                      <tr>
                        <th className="px-4 py-3">နေ့စွဲ</th>
                        <th className="px-3 py-3">ဝန်ထမ်း</th>
                        <th className="px-3 py-3">အမျိုးအစား</th>
                        <th className="px-3 py-3 text-right">ရက်အချိုး</th>
                        <th className="px-3 py-3">မှတ်ချက်</th>
                        <th className="px-3 py-3 text-right">လစဉ်စုစုပေါင်း</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1ee]">
                      {leaveRows.map(row => (
                        <tr key={row.id}>
                          <td className="px-4 py-3">{row.leaveDate}</td>
                          <td className="px-3 py-3 font-medium">
                            {row.employeeName}
                          </td>
                          <td className="px-3 py-3">
                            {
                              {
                                leave: "ခွင့်ယူ",
                                absent: "ပျက်ကွက်",
                                late: "နောက်ကျ",
                                other: "အခြား",
                              }[row.leaveType]
                            }
                          </td>
                          <td className="px-3 py-3 text-right">
                            {Number(row.dayUnits).toFixed(2)}
                          </td>
                          <td className="px-3 py-3">{row.note || "—"}</td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {Number(leaveTotals[row.employeeName] || 0).toFixed(
                              2
                            )}{" "}
                            ရက်
                          </td>
                          <td className="px-4 py-3 text-right">
                            {user?.role === "admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  deleteLeave.mutate({ id: row.id })
                                }
                                aria-label="ခွင့်မှတ်တမ်းဖျက်ရန်"
                              >
                                <Trash2 className="h-4 w-4 text-[#9a5b4d]" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {leaveRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-10 text-center text-[#89968d]"
                          >
                            ယခုလအတွက် ခွင့်မှတ်တမ်း မရှိသေးပါ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <p className="text-xs text-[#89968d]">
          ရွှေလက်ကျန်ကျပ်သားတွက်ရာတွင် ၁ ကျပ်သား = ၁၆ ပဲ = ၁၂၈ ရွေး
          သတ်မှတ်ထားသည်။ လှော်အိုး Kyoot ကို workbook ထဲရှိတွက်ချက်မှု
          (ရွေးတစ်ပဲလျှင် ၇.၅ ဟုသတ်မှတ်ထားသည့် ratio) အတိုင်းတွက်သည်။
        </p>
      </div>
    </div>
  );
}
