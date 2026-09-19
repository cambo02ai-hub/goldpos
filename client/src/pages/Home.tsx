import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CircleDollarSign, FileDown, Plus, RefreshCcw, Scale, Search, Sparkles, Trash2, WalletCards } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("my-MM", { day: "numeric", month: "short", year: "numeric" });

const emptyForm = { tradeDate: today(), transactionType: "sell" as "sell" | "buy", partyName: "", itemName: "", kyat: "", pae: "", yway: "", rate: "", note: "" };

type FormState = typeof emptyForm;

export default function Home() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "sell" | "buy">("all");
  const [dateFilter, setDateFilter] = useState("");
  const utils = trpc.useUtils();
  const listQuery = trpc.ledger.list.useQuery(undefined, { enabled: Boolean(user) });
  const summaryQuery = trpc.ledger.summary.useQuery(undefined, { enabled: Boolean(user) });
  const createMutation = trpc.ledger.create.useMutation({
    onSuccess: () => {
      toast.success("စာရင်းသွင်းပြီးပါပြီ");
      setForm({ ...emptyForm, tradeDate: form.tradeDate });
      void utils.ledger.list.invalidate();
      void utils.ledger.summary.invalidate();
    },
    onError: (error) => toast.error(error.message || "စာရင်းသွင်းရာတွင် အမှားရှိပါသည်"),
  });
  const removeMutation = trpc.ledger.remove.useMutation({
    onSuccess: () => {
      toast.success("စာရင်းဖျက်ပြီးပါပြီ");
      void utils.ledger.list.invalidate();
      void utils.ledger.summary.invalidate();
    },
    onError: (error) => toast.error(error.message || "ဖျက်၍မရပါ"),
  });

  const rows = useMemo(() => {
    const all = listQuery.data ?? [];
    return all.filter((row) => {
      const matchesSearch = !search || `${row.partyName} ${row.itemName ?? ""} ${row.note ?? ""}`.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || row.transactionType === typeFilter;
      const matchesDate = !dateFilter || row.tradeDate === dateFilter;
      return matchesSearch && matchesType && matchesDate;
    });
  }, [listQuery.data, search, typeFilter, dateFilter]);

  const summary = summaryQuery.data ?? { sellCount: 0, buyCount: 0, sellAmount: 0, buyAmount: 0, sellWeight: 0, buyWeight: 0 };
  const weight = Number(form.kyat || 0) + Number(form.pae || 0) / 16 + Number(form.yway || 0) / 128;
  const calculatedAmount = Math.round(weight * Number(form.rate || 0));

  const update = (key: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.partyName.trim()) return toast.error("အမည် ဖြည့်ပေးပါ");
    if (!form.rate || Number(form.rate) <= 0) return toast.error("Rate ဖြည့်ပေးပါ");
    createMutation.mutate({
      tradeDate: form.tradeDate,
      transactionType: form.transactionType,
      partyName: form.partyName.trim(),
      itemName: form.itemName.trim() || undefined,
      kyat: Number(form.kyat || 0), pae: Number(form.pae || 0), yway: Number(form.yway || 0), rate: Number(form.rate), note: form.note.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-[#17201d] -m-4 p-4 md:p-8">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#a06c18]"><Sparkles className="h-4 w-4" /> Ratanar Maung Gold House</div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">ရွှေနေ့စဉ် ဝယ် / ရောင်း စာရင်း</h1>
            <p className="mt-2 text-sm text-[#63716b]">နေ့စဉ် ရွှေစာရင်း၊ rate နှင့် အလေးချိန်ကို တစ်နေရာတည်းတွင် စီမံပါ။</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#dfe7e2] bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf3ed] text-[#2c6e49] font-bold">{user?.name?.charAt(0) || "U"}</div>
            <div><p className="text-sm font-semibold">{user?.name || "အသုံးပြုသူ"}</p><p className="text-xs text-[#738079]">{user?.role === "admin" ? "Admin Owner" : "Employee"}</p></div>
            <Badge variant="outline" className="ml-2 border-[#cfe2d4] bg-[#f5fbf6] text-[#2c6e49]">{user?.role === "admin" ? "ADMIN" : "STAFF"}</Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="ရောင်း စုစုပေါင်း" value={`${formatNumber(summary.sellAmount)} ကျပ်`} detail={`${summary.sellCount} စာရင်း · ${formatNumber(summary.sellWeight, 2)} ကျပ်သား`} icon={<ArrowUpRight className="h-5 w-5" />} tone="orange" />
          <SummaryCard label="ဝယ် စုစုပေါင်း" value={`${formatNumber(summary.buyAmount)} ကျပ်`} detail={`${summary.buyCount} စာရင်း · ${formatNumber(summary.buyWeight, 2)} ကျပ်သား`} icon={<ArrowDownLeft className="h-5 w-5" />} tone="green" />
          <SummaryCard label="Net cash flow" value={`${formatNumber(summary.sellAmount - summary.buyAmount)} ကျပ်`} detail="ရောင်း − ဝယ်" icon={<CircleDollarSign className="h-5 w-5" />} tone="purple" />
          <SummaryCard label="Stock balance" value={`${formatNumber(summary.sellWeight - summary.buyWeight, 2)} ကျပ်သား`} detail="ရောင်း − ဝယ်" icon={<Scale className="h-5 w-5" />} tone="blue" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.6fr)]">
          <Card className="overflow-hidden rounded-3xl border-[#e1e9e4] shadow-sm">
            <CardHeader className="border-b border-[#edf1ee] bg-white pb-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a06c18]">Quick entry</p><CardTitle className="mt-1 text-xl">စာရင်းအသစ် ထည့်ရန်</CardTitle></div><div className="rounded-2xl bg-[#f6f0e4] p-3 text-[#a06c18]"><Plus className="h-5 w-5" /></div></div></CardHeader>
            <CardContent className="bg-white p-5">
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>နေ့စွဲ</Label><Input type="date" value={form.tradeDate} onChange={(e) => update("tradeDate", e.target.value)} /></div>
                  <div className="space-y-2"><Label>အမျိုးအစား</Label><Tabs value={form.transactionType} onValueChange={(value) => update("transactionType", value)}><TabsList className="grid w-full grid-cols-2 bg-[#eef4ef]"><TabsTrigger value="sell" className="data-[state=active]:bg-[#fff3e2] data-[state=active]:text-[#a15f13]">ရောင်း</TabsTrigger><TabsTrigger value="buy" className="data-[state=active]:bg-[#e8f5eb] data-[state=active]:text-[#2c6e49]">ဝယ်</TabsTrigger></TabsList></Tabs></div>
                </div>
                <div className="space-y-2"><Label>ဝယ်သူ / ရောင်းသူ အမည်</Label><Input placeholder="ဥပမာ - ကိုဖိုးထူး" value={form.partyName} onChange={(e) => update("partyName", e.target.value)} /></div>
                <div className="space-y-2"><Label>ပစ္စည်းအမည် <span className="text-[#9ca8a0]">(မဖြည့်လည်းရ)</span></Label><Input placeholder="ဥပမာ - ရွှေလက်ကောက်" value={form.itemName} onChange={(e) => update("itemName", e.target.value)} /></div>
                <div><Label className="mb-2 block">အလေးချိန်</Label><div className="grid grid-cols-3 gap-2"><WeightInput label="ကျပ်" value={form.kyat} onChange={(value) => update("kyat", value)} /><WeightInput label="ပဲ" value={form.pae} onChange={(value) => update("pae", value)} /><WeightInput label="ရွေး" value={form.yway} onChange={(value) => update("yway", value)} step="0.1" /></div></div>
                <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Rate (ကျပ်)</Label><Input type="number" min="0" placeholder="10,000,000" value={form.rate} onChange={(e) => update("rate", e.target.value)} /></div><div className="rounded-xl border border-[#e6ece8] bg-[#f8faf8] p-3"><p className="text-xs text-[#78867e]">တွက်ချက်ထားသော Amount</p><p className="mt-1 text-base font-semibold text-[#1f5e3a]">{formatNumber(calculatedAmount)} ကျပ်</p></div></div>
                <div className="space-y-2"><Label>မှတ်ချက်</Label><Input placeholder="မှတ်ချက်ထည့်ရန်" value={form.note} onChange={(e) => update("note", e.target.value)} /></div>
                <Button type="submit" disabled={createMutation.isPending} className="h-11 w-full rounded-xl bg-[#276044] text-white shadow-sm hover:bg-[#1f5038]">{createMutation.isPending ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}စာရင်းသွင်းမည်</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-[#e1e9e4] shadow-sm">
            <CardHeader className="gap-4 border-b border-[#edf1ee] bg-white pb-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c6e49]">Transaction journal</p><CardTitle className="mt-1 text-xl">နေ့စဉ်စာရင်းများ</CardTitle></div><Button variant="outline" size="sm" onClick={() => window.print()} className="border-[#dfe7e2] text-[#53645b]"><FileDown className="mr-2 h-4 w-4" />Print / Export</Button></div><div className="flex flex-col gap-2 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aa79f]" /><Input className="pl-9" placeholder="အမည်၊ ပစ္စည်း၊ မှတ်ချက် ရှာရန်" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Input type="date" className="md:w-[160px]" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} /><Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | "sell" | "buy")}><TabsList className="bg-[#eef4ef]"><TabsTrigger value="all">အားလုံး</TabsTrigger><TabsTrigger value="sell">ရောင်း</TabsTrigger><TabsTrigger value="buy">ဝယ်</TabsTrigger></TabsList></Tabs></div></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#f8faf8] text-left text-xs uppercase tracking-wide text-[#748079]"><tr><th className="px-5 py-3">နေ့စွဲ</th><th className="px-3 py-3">အမျိုးအစား</th><th className="px-3 py-3">အမည် / ပစ္စည်း</th><th className="px-3 py-3 text-right">အလေးချိန်</th><th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Amount</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-[#edf1ee]">{listQuery.isLoading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-[#839087]">စာရင်းများ ဖတ်နေပါသည်…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-[#839087]">စာရင်းမတွေ့ပါ</td></tr> : rows.map((row) => <tr key={row.id} className="transition-colors hover:bg-[#fbfdfb]"><td className="whitespace-nowrap px-5 py-3.5 font-medium text-[#526159]">{formatDate(row.tradeDate)}</td><td className="px-3 py-3.5"><Badge className={row.transactionType === "sell" ? "border-0 bg-[#fff1df] text-[#a15f13]" : "border-0 bg-[#e7f5ea] text-[#2c6e49]"}>{row.transactionType === "sell" ? "ရောင်း" : "ဝယ်"}</Badge></td><td className="px-3 py-3.5"><p className="font-semibold text-[#25322b]">{row.partyName}</p><p className="mt-0.5 text-xs text-[#8b968f]">{row.itemName || row.note || "—"}</p></td><td className="px-3 py-3.5 text-right font-mono text-[#53645b]">{formatNumber(row.kyat)} ကျပ် {formatNumber(row.pae)} ပဲ {formatNumber(row.yway, 1)} ရွေး</td><td className="px-3 py-3.5 text-right font-mono text-[#53645b]">{formatNumber(row.rate)}</td><td className="px-3 py-3.5 text-right font-mono font-semibold text-[#25322b]">{formatNumber(row.amount)}</td><td className="px-4 py-3.5 text-right">{user?.role === "admin" && <Button variant="ghost" size="icon" aria-label="Delete transaction" onClick={() => removeMutation.mutate({ id: row.id })} className="h-8 w-8 text-[#b16d65] hover:bg-[#fff1ef] hover:text-[#9c3b30]"><Trash2 className="h-4 w-4" /></Button>}</td></tr>)}</tbody></table></div></CardContent>
          </Card>
        </div>
        <p className="flex items-center gap-2 text-xs text-[#8a958e]"><CalendarDays className="h-3.5 w-3.5" /> အလေးချိန်တွက်ချက်မှုသည် ကျပ် + ပဲ / ၁၆ + ရွေး / ၁၂၈ ပုံစံဖြင့် အလိုအလျောက်တွက်ထားပါသည်။</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: "orange" | "green" | "purple" | "blue" }) {
  const tones = { orange: "bg-[#fff4e3] text-[#a15f13]", green: "bg-[#e8f5eb] text-[#2c6e49]", purple: "bg-[#f1ecfb] text-[#7651a8]", blue: "bg-[#e8f2fb] text-[#3e6f9e]" };
  return <Card className="rounded-3xl border-[#e1e9e4] shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#839087]">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight text-[#25322b]">{value}</p><p className="mt-1 text-xs text-[#839087]">{detail}</p></div><div className={`rounded-2xl p-3 ${tones[tone]}`}>{icon}</div></div></CardContent></Card>;
}

function WeightInput({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
  return <div className="relative"><Input type="number" min="0" step={step} placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} className="pr-11" /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[#89968d]">{label}</span></div>;
}
