import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { hasEmployeePermission } from "@shared/permissions";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type EntryType = "income" | "expense" | "capital" | "drawing";
type PaymentMethod = "cash" | "bank" | "kbzpay" | "wavepay" | "other";
type OutstandingTransaction = {
  id: number;
  tradeDate: string;
  transactionType: "sell" | "buy";
  partyName: string;
  itemName: string | null;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value || 0);
const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("my-MM", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => `${today().slice(0, 7)}-01`;
const paymentLabels: Record<PaymentMethod, string> = {
  cash: "ငွေသား",
  bank: "ဘဏ်",
  kbzpay: "KBZPay",
  wavepay: "Wave Money",
  other: "အခြား",
};
const entryLabels: Record<EntryType, string> = {
  income: "အခြားဝင်ငွေ",
  expense: "အသုံးစရိတ်",
  capital: "မတည်ငွေ",
  drawing: "ကိုယ်ပိုင်ထုတ်ငွေ",
};

export default function Finance() {
  const { user } = useAuth();
  const canWriteFinance = hasEmployeePermission(user, "finance", "write");
  const canManageFinance = hasEmployeePermission(user, "finance", "manage");
  const [rangeMode, setRangeMode] = useState<"month" | "today" | "all">(
    "month"
  );
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);
  const [entryOpen, setEntryOpen] = useState(false);
  const [settlementRow, setSettlementRow] =
    useState<OutstandingTransaction | null>(null);
  const utils = trpc.useUtils();
  const filters = useMemo(
    () =>
      rangeMode === "all"
        ? undefined
        : rangeMode === "today"
          ? { from: today(), to: today() }
          : { from, to },
    [rangeMode, from, to]
  );
  const summaryQuery = trpc.finance.summary.useQuery(filters, {
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
  });
  const cashBookQuery = trpc.finance.cashBook.useQuery(filters, {
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
  });
  const outstandingQuery = trpc.finance.outstanding.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
  });
  const removeEntry = trpc.finance.removeEntry.useMutation({
    onSuccess: () => {
      void utils.finance.cashBook.invalidate();
      void utils.finance.summary.invalidate();
      toast.success("စာရင်းဖျက်ပြီးပါပြီ");
    },
    onError: error => toast.error(error.message),
  });
  const summary = summaryQuery.data ?? {
    sales: 0,
    purchases: 0,
    salesCollected: 0,
    purchasesPaid: 0,
    otherIncome: 0,
    expenses: 0,
    capital: 0,
    drawings: 0,
    collections: 0,
    supplierPayments: 0,
    cashIn: 0,
    cashOut: 0,
    netCashMovement: 0,
    receivables: 0,
    payables: 0,
    receivableCount: 0,
    payableCount: 0,
  };
  const cashBook = cashBookQuery.data ?? [];
  const outstanding = outstandingQuery.data ?? [];
  const receivables = outstanding.filter(
    row => row.transactionType === "sell"
  ) as OutstandingTransaction[];
  const payables = outstanding.filter(
    row => row.transactionType === "buy"
  ) as OutstandingTransaction[];
  const rangeLabel =
    rangeMode === "all"
      ? "မှတ်တမ်းအားလုံး"
      : rangeMode === "today"
        ? "ယနေ့"
        : `${from} မှ ${to}`;

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-[#17201d] -m-2 p-3 sm:-m-4 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="border-b border-[#e4ebe6] pb-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">
                Financial accounting
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                ငွေစာရင်းနှင့် အစီရင်ခံစာ
              </h1>
              <p className="mt-1 text-sm text-[#68756d]">
                အရောင်း/အဝယ်၊ အသုံးစရိတ်၊ ဝင်ငွေ နှင့် အကြွေးကျန်များကို
                တစ်နေရာတည်းတွင် စီမံပါ။
              </p>
            </div>
            <div className="rounded-xl border border-[#dfe8e2] bg-white p-2 shadow-sm">
              <Tabs
                value={rangeMode}
                onValueChange={value =>
                  setRangeMode(value as "month" | "today" | "all")
                }
              >
                <TabsList className="bg-[#eef4ef]">
                  <TabsTrigger value="today">ယနေ့</TabsTrigger>
                  <TabsTrigger value="month">ကာလရွေး</TabsTrigger>
                  <TabsTrigger value="all">အားလုံး</TabsTrigger>
                </TabsList>
              </Tabs>
              {rangeMode === "month" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    aria-label="From date"
                    type="date"
                    className="h-8 w-[145px] text-xs"
                    value={from}
                    onChange={event => setFrom(event.target.value)}
                  />
                  <Input
                    aria-label="To date"
                    type="date"
                    className="h-8 w-[145px] text-xs"
                    value={to}
                    onChange={event => setTo(event.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <SummaryCard
            label="စုစုပေါင်း ငွေဝင်"
            value={summary.cashIn}
            detail="ရောင်းငွေ၊ အကြွေးလက်ခံ၊ ဝင်ငွေ"
            icon={<ArrowUpRight className="h-4 w-4" />}
            tone="green"
          />
          <SummaryCard
            label="စုစုပေါင်း ငွေထွက်"
            value={summary.cashOut}
            detail="အဝယ်၊ အကြွေးပေး၊ အသုံးစရိတ်"
            icon={<ArrowDownLeft className="h-4 w-4" />}
            tone="orange"
          />
          <SummaryCard
            label="ငွေလှုပ်ရှားမှု လက်ကျန်"
            value={summary.netCashMovement}
            detail="ငွေဝင် − ငွေထွက်"
            icon={<CircleDollarSign className="h-4 w-4" />}
            tone={summary.netCashMovement >= 0 ? "purple" : "red"}
          />
          <SummaryCard
            label="ရရန်အကြွေး"
            value={summary.receivables}
            detail={`${summary.receivableCount} စာရင်း ကျန်ရှိ`}
            icon={<HandCoins className="h-4 w-4" />}
            tone="blue"
          />
          <SummaryCard
            label="ပေးရန်အကြွေး"
            value={summary.payables}
            detail={`${summary.payableCount} စာရင်း ကျန်ရှိ`}
            icon={<Landmark className="h-4 w-4" />}
            tone="red"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
            <CardHeader className="border-b border-[#edf1ee] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2c6e49]">
                    Period report
                  </p>
                  <CardTitle className="mt-1 text-xl">
                    ငွေကြေးအကျဉ်းချုပ်
                  </CardTitle>
                  <p className="mt-1 text-xs text-[#78867e]">{rangeLabel}</p>
                </div>
                {canWriteFinance && (
                  <Button
                    size="sm"
                    onClick={() => setEntryOpen(true)}
                    className="bg-[#276044] text-white hover:bg-[#1f5038]"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    ဝင်/ထွက်စာရင်း
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#edf1ee] text-sm">
                <ReportLine
                  label="အရောင်းစုစုပေါင်း"
                  value={summary.sales}
                  detail={`လက်ခံပြီး ${formatNumber(summary.salesCollected)}`}
                  tone="in"
                />
                <ReportLine
                  label="အဝယ်စုစုပေါင်း"
                  value={summary.purchases}
                  detail={`ပေးချေပြီး ${formatNumber(summary.purchasesPaid)}`}
                  tone="out"
                />
                <ReportLine
                  label="အကြွေးလက်ခံငွေ"
                  value={summary.collections}
                  tone="in"
                />
                <ReportLine
                  label="ပေးရန်အကြွေး ရှင်းငွေ"
                  value={summary.supplierPayments}
                  tone="out"
                />
                <ReportLine
                  label="အခြားဝင်ငွေ"
                  value={summary.otherIncome}
                  tone="in"
                />
                <ReportLine
                  label="အသုံးစရိတ်"
                  value={summary.expenses}
                  tone="out"
                />
                <ReportLine
                  label="မတည်ငွေ ထည့်သွင်း"
                  value={summary.capital}
                  tone="in"
                />
                <ReportLine
                  label="ကိုယ်ပိုင်ထုတ်ငွေ"
                  value={summary.drawings}
                  tone="out"
                />
                <div className="flex items-center justify-between bg-[#f4faf5] px-5 py-4">
                  <div>
                    <p className="font-bold text-[#25322b]">
                      ကာလအတွင်း ငွေလှုပ်ရှားမှု
                    </p>
                    <p className="mt-0.5 text-xs text-[#78867e]">
                      လက်ကျန်ငွေအစ မထည့်သွင်းရသေးပါ
                    </p>
                  </div>
                  <p
                    className={`font-mono text-lg font-bold ${summary.netCashMovement >= 0 ? "text-[#1f6c45]" : "text-[#b14a3f]"}`}
                  >
                    {summary.netCashMovement >= 0 ? "+" : ""}
                    {formatNumber(summary.netCashMovement)} ကျပ်
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
            <CardHeader className="border-b border-[#edf1ee] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2c6e49]">
                Credit control
              </p>
              <CardTitle className="mt-1 text-xl">
                အကြွေးကျန် စီမံခန့်ခွဲမှု
              </CardTitle>
              <p className="mt-1 text-xs text-[#78867e]">
                ရရန်နှင့် ပေးရန် အကြွေးများကို လက်ခံ/ပေးချေပြီး
                ချက်ချင်းစာရင်းသွင်းနိုင်သည်။
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <DebtSection
                title="ရရန်အကြွေး"
                rows={receivables}
                empty="လက်ခံရန်အကြွေး မရှိပါ"
                onSettle={canWriteFinance ? setSettlementRow : undefined}
              />
              <DebtSection
                title="ပေးရန်အကြွေး"
                rows={payables}
                empty="ပေးရန်အကြွေး မရှိပါ"
                onSettle={canWriteFinance ? setSettlementRow : undefined}
              />
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2c6e49]">
                  Cash book
                </p>
                <CardTitle className="mt-1 text-xl">
                  ငွေဝင်/ငွေထွက် စာအုပ်
                </CardTitle>
                <p className="mt-1 text-xs text-[#78867e]">
                  {rangeLabel} အတွင်း လက်ခံ၊ ပေးချေ၊ အသုံးစရိတ် စာရင်းများ
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void summaryQuery.refetch();
                  void cashBookQuery.refetch();
                  void outstandingQuery.refetch();
                }}
              >
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                ပြန်ဖတ်မည်
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {cashBookQuery.isLoading ? (
              <div className="px-5 py-12 text-center text-sm text-[#839087]">
                စာရင်းများ ဖတ်နေပါသည်…
              </div>
            ) : cashBook.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-[#839087]">
                <BookOpen className="mx-auto mb-2 h-5 w-5" />
                ဤကာလအတွက် ငွေစာရင်း မရှိသေးပါ
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead className="bg-[#f8faf8] text-left text-xs uppercase tracking-wide text-[#748079]">
                    <tr>
                      <th className="px-5 py-3">နေ့စွဲ</th>
                      <th className="px-3 py-3">အမျိုးအစား / အကြောင်းအရာ</th>
                      <th className="px-3 py-3">ပေးချေနည်း</th>
                      <th className="px-3 py-3 text-right">ငွေဝင်</th>
                      <th className="px-3 py-3 text-right">ငွေထွက်</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1ee]">
                    {cashBook.map(row => (
                      <tr key={row.id} className="hover:bg-[#fbfdfb]">
                        <td className="whitespace-nowrap px-5 py-3.5 text-[#53645b]">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="font-semibold text-[#25322b]">
                            {row.source}
                          </p>
                          <p className="mt-0.5 text-xs text-[#78867e]">
                            {row.description}
                            {row.note ? ` — ${row.note}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 text-[#53645b]">
                          {paymentLabels[row.paymentMethod as PaymentMethod] ??
                            row.paymentMethod}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono font-semibold text-[#1f6c45]">
                          {row.cashIn ? formatNumber(row.cashIn) : "—"}
                        </td>
                        <td className="px-3 py-3.5 text-right font-mono font-semibold text-[#b14a3f]">
                          {row.cashOut ? formatNumber(row.cashOut) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {canManageFinance && row.id.startsWith("entry-") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete cash entry"
                              onClick={() =>
                                removeEntry.mutate({
                                  id: Number(row.id.replace("entry-", "")),
                                })
                              }
                              className="h-8 w-8 text-[#b16d65] hover:bg-[#fff1ef] hover:text-[#9c3b30]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <CashEntryDialog open={entryOpen} onOpenChange={setEntryOpen} />
        <SettlementDialog
          row={settlementRow}
          onClose={() => setSettlementRow(null)}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  tone: "green" | "orange" | "purple" | "blue" | "red";
}) {
  const tones = {
    green: "bg-[#e8f5eb] text-[#2c6e49]",
    orange: "bg-[#fff4e3] text-[#a15f13]",
    purple: "bg-[#f1ecfb] text-[#7651a8]",
    blue: "bg-[#e8f2fb] text-[#3e6f9e]",
    red: "bg-[#fff0ee] text-[#b14a3f]",
  };
  return (
    <Card className="rounded-xl border-[#e1e9e4] shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-[#839087]">
              {label}
            </p>
            <p className="mt-1 truncate text-sm font-bold tracking-tight text-[#25322b] sm:text-base">
              {formatNumber(value)} ကျပ်
            </p>
            <p className="mt-0.5 truncate text-[10px] text-[#839087]">
              {detail}
            </p>
          </div>
          <div className={`shrink-0 rounded-lg p-2 ${tones[tone]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportLine({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail?: string;
  tone: "in" | "out";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div>
        <p className="font-medium text-[#435148]">{label}</p>
        {detail && <p className="mt-0.5 text-xs text-[#87928b]">{detail}</p>}
      </div>
      <p
        className={`font-mono font-semibold ${tone === "in" ? "text-[#267349]" : "text-[#b06a1b]"}`}
      >
        {tone === "in" ? "+" : "−"}
        {formatNumber(value)} ကျပ်
      </p>
    </div>
  );
}

function DebtSection({
  title,
  rows,
  empty,
  onSettle,
}: {
  title: string;
  rows: OutstandingTransaction[];
  empty: string;
  onSettle?: (row: OutstandingTransaction) => void;
}) {
  return (
    <div className="rounded-xl border border-[#e4ebe6]">
      <div className="flex items-center justify-between border-b border-[#edf1ee] bg-[#fbfdfb] px-3 py-2.5">
        <p className="text-sm font-bold text-[#35433b]">{title}</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#78867e]">
          {rows.length} ခု
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-[#89968d]">{empty}</p>
      ) : (
        <div className="divide-y divide-[#edf1ee]">
          {rows.map(row => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#25322b]">
                  {row.partyName}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#78867e]">
                  {row.itemName || "ရွှေစာရင်း"} · {formatDate(row.tradeDate)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#a15f13]">
                  ကျန် {formatNumber(row.outstandingAmount)} ကျပ်
                </p>
              </div>
              {onSettle && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSettle(row)}
                  className="shrink-0 border-[#dfe7e2] text-[#2c6e49]"
                >
                  ရှင်းမည်
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CashEntryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [entryType, setEntryType] = useState<EntryType>("expense");
  const [entryDate, setEntryDate] = useState(today);
  const [category, setCategory] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const createMutation = trpc.finance.createEntry.useMutation({
    onSuccess: () => {
      void utils.finance.summary.invalidate();
      void utils.finance.cashBook.invalidate();
      setCategory("");
      setCounterparty("");
      setAmount("");
      setNote("");
      onOpenChange(false);
      toast.success("ငွေစာရင်းသွင်းပြီးပါပြီ");
    },
    onError: error =>
      toast.error(error.message || "စာရင်းသွင်းရာတွင် အမှားရှိပါသည်"),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!category.trim()) return toast.error("အမျိုးအစား ဖြည့်ပေးပါ");
    if (Number(amount) <= 0) return toast.error("ပမာဏ မှန်ကန်စွာ ဖြည့်ပေးပါ");
    createMutation.mutate({
      entryDate,
      entryType,
      category: category.trim(),
      counterparty: counterparty.trim() || undefined,
      amount: Number(amount),
      paymentMethod,
      note: note.trim() || undefined,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ဝင်/ထွက် ငွေစာရင်းသွင်းရန်</DialogTitle>
          <DialogDescription>
            ရွှေရောင်း/ဝယ်နှင့် မသက်ဆိုင်သော ဝင်ငွေ၊ အသုံးစရိတ်၊ မတည်ငွေများကို
            မှတ်တမ်းတင်ပါ။
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>အမျိုးအစား</Label>
            <Tabs
              value={entryType}
              onValueChange={value => setEntryType(value as EntryType)}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 bg-[#eef4ef] sm:grid-cols-4">
                {(Object.keys(entryLabels) as EntryType[]).map(type => (
                  <TabsTrigger key={type} value={type} className="px-2 text-xs">
                    {entryLabels[type]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>နေ့စွဲ</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={event => setEntryDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ငွေပေးချေနည်း</Label>
              <PaymentMethodSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>အမျိုးအစား / ခေါင်းစဉ်</Label>
              <Input
                placeholder={
                  entryType === "expense"
                    ? "ဥပမာ - ဆိုင်ခန်းငှားခ"
                    : "ဥပမာ - အခြားဝင်ငွေ"
                }
                value={category}
                onChange={event => setCategory(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ပမာဏ (ကျပ်)</Label>
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={event => setAmount(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>သက်ဆိုင်သူ / မှတ်ချက်</Label>
            <Input
              placeholder="ဥပမာ - မန်နေဂျာ၊ ဈေးရောင်းသူ"
              value={counterparty}
              onChange={event => setCounterparty(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>ထပ်ဆောင်းမှတ်ချက်</Label>
            <Input
              placeholder="လိုအပ်လျှင် ထည့်ပါ"
              value={note}
              onChange={event => setNote(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full bg-[#276044] text-white hover:bg-[#1f5038]"
          >
            {createMutation.isPending && (
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
            )}
            စာရင်းသွင်းမည်
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettlementDialog({
  row,
  onClose,
}: {
  row: OutstandingTransaction | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [settlementDate, setSettlementDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const settleMutation = trpc.finance.settle.useMutation({
    onSuccess: () => {
      void utils.finance.summary.invalidate();
      void utils.finance.cashBook.invalidate();
      void utils.finance.outstanding.invalidate();
      setAmount("");
      setNote("");
      onClose();
      toast.success("အကြွေးစာရင်း ရှင်းပြီးပါပြီ");
    },
    onError: error =>
      toast.error(error.message || "အကြွေးစာရင်းရှင်းရာတွင် အမှားရှိပါသည်"),
  });
  if (!row) return null;
  const isCollection = row.transactionType === "sell";
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const paid = Number(amount || row.outstandingAmount);
    if (paid <= 0 || paid > row.outstandingAmount)
      return toast.error("ကျန်ငွေအတွင်းသာ ထည့်ပေးပါ");
    settleMutation.mutate({
      transactionId: row.id,
      settlementDate,
      settlementType: isCollection ? "collection" : "payment",
      amount: paid,
      paymentMethod,
      note: note.trim() || undefined,
    });
  };
  return (
    <Dialog open={Boolean(row)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCollection ? "အကြွေးလက်ခံရန်" : "အကြွေးပေးချေရန်"}
          </DialogTitle>
          <DialogDescription>
            {row.partyName} · ကျန်ငွေ {formatNumber(row.outstandingAmount)} ကျပ်
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg border border-[#e0e9e2] bg-[#fbfdfb] p-3 text-sm">
            <p className="font-semibold text-[#25322b]">
              {row.itemName || "ရွှေစာရင်း"}
            </p>
            <p className="mt-1 text-[#78867e]">
              မူလစာရင်း {formatNumber(row.amount)} ကျပ် · ပေး/လက်ခံပြီး{" "}
              {formatNumber(row.paidAmount)} ကျပ်
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>နေ့စွဲ</Label>
              <Input
                type="date"
                value={settlementDate}
                onChange={event => setSettlementDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ငွေပေးချေနည်း</Label>
              <PaymentMethodSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{isCollection ? "လက်ခံမည့်ငွေ" : "ပေးချေမည့်ငွေ"}</Label>
            <Input
              type="number"
              min="1"
              max={row.outstandingAmount}
              placeholder={formatNumber(row.outstandingAmount)}
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>မှတ်ချက်</Label>
            <Input
              placeholder="လိုအပ်လျှင် ထည့်ပါ"
              value={note}
              onChange={event => setNote(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={settleMutation.isPending}
            className="w-full bg-[#276044] text-white hover:bg-[#1f5038]"
          >
            {settleMutation.isPending && (
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isCollection
              ? "လက်ခံပြီး စာရင်းသွင်းမည်"
              : "ပေးချေပြီး စာရင်းသွင်းမည်"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentMethodSelect({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value as PaymentMethod)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="cash">ငွေသား</option>
      <option value="bank">ဘဏ်</option>
      <option value="kbzpay">KBZPay</option>
      <option value="wavepay">Wave Money</option>
      <option value="other">အခြား</option>
    </select>
  );
}
