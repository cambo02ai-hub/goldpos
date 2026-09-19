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
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  FileDown,
  Filter,
  Plus,
  RefreshCcw,
  Scale,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);
const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("my-MM", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const emptyForm = {
  tradeDate: today(),
  transactionType: "sell" as "sell" | "buy",
  partyName: "",
  itemName: "",
  kyat: "",
  pae: "",
  yway: "",
  rate: "",
  note: "",
};
type FormState = typeof emptyForm;

type FilterType = "all" | "sell" | "buy";

export default function Home() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const utils = trpc.useUtils();
  const listQuery = trpc.ledger.list.useQuery(undefined, { enabled: Boolean(user) });
  const summaryQuery = trpc.ledger.summary.useQuery(undefined, { enabled: Boolean(user) });

  const createMutation = trpc.ledger.create.useMutation({
    onSuccess: () => {
      toast.success("စာရင်းသွင်းပြီးပါပြီ");
      setForm({ ...emptyForm, tradeDate: form.tradeDate, transactionType: form.transactionType });
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
    const normalizedSearch = search.trim().toLowerCase();
    return (listQuery.data ?? []).filter((row) => {
      const haystack = `${row.partyName} ${row.itemName ?? ""} ${row.note ?? ""}`.toLowerCase();
      return (
        (!normalizedSearch || haystack.includes(normalizedSearch)) &&
        (typeFilter === "all" || row.transactionType === typeFilter) &&
        (!dateFilter || row.tradeDate === dateFilter)
      );
    });
  }, [listQuery.data, search, typeFilter, dateFilter]);

  const summary = summaryQuery.data ?? {
    sellCount: 0,
    buyCount: 0,
    sellAmount: 0,
    buyAmount: 0,
    sellWeight: 0,
    buyWeight: 0,
  };
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
      kyat: Number(form.kyat || 0),
      pae: Number(form.pae || 0),
      yway: Number(form.yway || 0),
      rate: Number(form.rate),
      note: form.note.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-[#17201d] -m-2 p-3 sm:-m-4 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1360px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-[#e4ebe6] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">Ratanar Maung Gold House</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ရွှေ ဝယ် / ရောင်း စာရင်း</h1>
            <p className="mt-1 text-sm text-[#68756d]">နေ့စဉ်စာရင်းကို ရိုးရှင်းစွာ ထည့်သွင်းပြီး ချက်ချင်းရှာဖွေပါ။</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-[#e1e9e4]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ed] font-bold text-[#2c6e49]">{user?.name?.charAt(0) || "U"}</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name || "အသုံးပြုသူ"}</p><p className="text-xs text-[#738079]">{user?.role === "admin" ? "Admin Owner" : "Employee"}</p></div>
            <Badge variant="outline" className="ml-1 border-[#cfe2d4] bg-[#f5fbf6] text-[#2c6e49]">{user?.role === "admin" ? "ADMIN" : "STAFF"}</Badge>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="ရောင်း စုစုပေါင်း" value={`${formatNumber(summary.sellAmount)} ကျပ်`} detail={`${summary.sellCount} စာရင်း · ${formatNumber(summary.sellWeight, 2)} ကျပ်သား`} icon={<ArrowUpRight className="h-4 w-4" />} tone="orange" />
          <SummaryCard label="ဝယ် စုစုပေါင်း" value={`${formatNumber(summary.buyAmount)} ကျပ်`} detail={`${summary.buyCount} စာရင်း · ${formatNumber(summary.buyWeight, 2)} ကျပ်သား`} icon={<ArrowDownLeft className="h-4 w-4" />} tone="green" />
          <SummaryCard label="Net cash flow" value={`${formatNumber(summary.sellAmount - summary.buyAmount)} ကျပ်`} detail="ရောင်း − ဝယ်" icon={<CircleDollarSign className="h-4 w-4" />} tone="purple" />
          <SummaryCard label="Stock balance" value={`${formatNumber(summary.sellWeight - summary.buyWeight, 2)} ကျပ်သား`} detail="ရောင်း − ဝယ်" icon={<Scale className="h-4 w-4" />} tone="blue" />
        </section>

        <Card className="overflow-hidden rounded-2xl border-[#dfe8e2] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2c6e49]">Quick entry</p><CardTitle className="mt-1 text-xl">စာရင်းအသစ် ထည့်ရန်</CardTitle></div>
              <div className="flex items-center gap-2 text-xs text-[#738079]"><CalendarDays className="h-4 w-4" /> အလေးချိန်: ကျပ် + ပဲ/၁၆ + ရွေး/၁၂၈</div>
            </div>
          </CardHeader>
          <CardContent className="bg-white px-4 py-4 sm:px-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[150px_180px_minmax(0,1fr)]">
                <div className="space-y-1.5"><Label>နေ့စွဲ</Label><Input type="date" value={form.tradeDate} onChange={(e) => update("tradeDate", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>အမျိုးအစား</Label><Tabs value={form.transactionType} onValueChange={(value) => update("transactionType", value)}><TabsList className="grid w-full grid-cols-2 bg-[#eef4ef]"><TabsTrigger value="sell" className="data-[state=active]:bg-[#fff3e2] data-[state=active]:text-[#a15f13]">ရောင်း</TabsTrigger><TabsTrigger value="buy" className="data-[state=active]:bg-[#e8f5eb] data-[state=active]:text-[#2c6e49]">ဝယ်</TabsTrigger></TabsList></Tabs></div>
                <div className="space-y-1.5"><Label>ဝယ်သူ / ရောင်းသူ အမည် <span className="text-[#b84b3e]">*</span></Label><Input autoFocus placeholder="ဥပမာ - ကိုဖိုးထူး" value={form.partyName} onChange={(e) => update("partyName", e.target.value)} /></div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                <div><Label className="mb-1.5 block">အလေးချိန် <span className="text-[#b84b3e]">*</span></Label><div className="grid grid-cols-3 gap-2"><WeightInput label="ကျပ်" value={form.kyat} onChange={(value) => update("kyat", value)} /><WeightInput label="ပဲ" value={form.pae} onChange={(value) => update("pae", value)} /><WeightInput label="ရွေး" value={form.yway} onChange={(value) => update("yway", value)} step="0.1" /></div></div>
                <div className="space-y-1.5"><Label>Rate (ကျပ်) <span className="text-[#b84b3e]">*</span></Label><Input type="number" min="0" placeholder="10,000,000" value={form.rate} onChange={(e) => update("rate", e.target.value)} /></div>
                <div className="flex items-end justify-between gap-3 rounded-xl border border-[#dcebe0] bg-[#f4faf5] px-4 py-2.5"><div><p className="text-xs text-[#68756d]">တွက်ချက်ထားသော Amount</p><p className="text-lg font-bold text-[#1f5e3a]">{formatNumber(calculatedAmount)} ကျပ်</p></div><Button type="submit" disabled={createMutation.isPending} className="h-10 rounded-lg bg-[#276044] px-5 text-white hover:bg-[#1f5038]">{createMutation.isPending ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}သွင်းမည်</Button></div>
              </div>
              <div className="border-t border-[#edf1ee] pt-3"><button type="button" onClick={() => setShowOptional((value) => !value)} className="flex items-center gap-2 text-sm font-medium text-[#53645b] hover:text-[#276044]"><Settings2 className="h-4 w-4" /> Optional details {showOptional ? "ဖျောက်မည်" : "ထည့်မည်"}</button>{showOptional && <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>ပစ္စည်းအမည်</Label><Input placeholder="ဥပမာ - ရွှေလက်ကောက်" value={form.itemName} onChange={(e) => update("itemName", e.target.value)} /></div><div className="space-y-1.5"><Label>မှတ်ချက်</Label><Input placeholder="မှတ်ချက်ထည့်ရန်" value={form.note} onChange={(e) => update("note", e.target.value)} /></div></div>}</div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#dfe8e2] shadow-sm">
          <CardHeader className="gap-3 border-b border-[#edf1ee] bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2c6e49]">Transaction journal</p><CardTitle className="mt-1 text-xl">နေ့စဉ်စာရင်းများ <span className="ml-1 text-sm font-normal text-[#89968d]">({rows.length})</span></CardTitle></div><Button variant="outline" size="sm" onClick={() => window.print()} className="w-fit border-[#dfe7e2] text-[#53645b]"><FileDown className="mr-2 h-4 w-4" />Print / Export</Button></div>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aa79f]" /><Input className="pl-9" placeholder="အမည်၊ ပစ္စည်း ရှာရန်" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
              <Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as FilterType)}><TabsList className="w-full bg-[#eef4ef] lg:w-auto"><TabsTrigger value="all" className="flex-1 lg:flex-none">အားလုံး</TabsTrigger><TabsTrigger value="sell" className="flex-1 lg:flex-none">ရောင်း</TabsTrigger><TabsTrigger value="buy" className="flex-1 lg:flex-none">ဝယ်</TabsTrigger></TabsList></Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {listQuery.isLoading ? <div className="px-5 py-12 text-center text-[#839087]">စာရင်းများ ဖတ်နေပါသည်…</div> : rows.length === 0 ? <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-[#839087]"><Filter className="h-5 w-5" />စာရင်းမတွေ့ပါ</div> : <>
              <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#f8faf8] text-left text-xs uppercase tracking-wide text-[#748079]"><tr><th className="px-5 py-3">နေ့စွဲ</th><th className="px-3 py-3">အမျိုးအစား</th><th className="px-3 py-3">အမည် / ပစ္စည်း</th><th className="px-3 py-3 text-right">အလေးချိန်</th><th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-[#edf1ee]">{rows.map((row) => <TransactionRow key={row.id} row={row} userRole={user?.role} onRemove={(id) => removeMutation.mutate({ id })} />)}</tbody></table></div>
              <div className="divide-y divide-[#edf1ee] md:hidden">{rows.map((row) => <MobileTransaction key={row.id} row={row} userRole={user?.role} onRemove={(id) => removeMutation.mutate({ id })} />)}</div>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TransactionRow({ row, userRole, onRemove }: { row: any; userRole?: string; onRemove: (id: number) => void }) {
  return <tr className="transition-colors hover:bg-[#fbfdfb]"><td className="whitespace-nowrap px-5 py-3.5 font-medium text-[#526159]">{formatDate(row.tradeDate)}</td><td className="px-3 py-3.5"><TypeBadge type={row.transactionType} /></td><td className="px-3 py-3.5"><p className="font-semibold text-[#25322b]">{row.partyName}</p><p className="mt-0.5 text-xs text-[#8b968f]">{row.itemName || row.note || "—"}</p></td><td className="px-3 py-3.5 text-right text-xs text-[#53645b]">{formatWeight(row)}</td><td className="px-3 py-3.5 text-right font-mono text-[#53645b]">{formatNumber(row.rate)}</td><td className="px-3 py-3.5 text-right font-mono font-semibold text-[#25322b]">{formatNumber(row.amount)}</td><td className="px-4 py-3.5 text-right">{userRole === "admin" && <DeleteButton onClick={() => onRemove(row.id)} />}</td></tr>;
}

function MobileTransaction({ row, userRole, onRemove }: { row: any; userRole?: string; onRemove: (id: number) => void }) {
  return <div className="flex items-start justify-between gap-3 px-4 py-3.5"><div className="min-w-0"><div className="flex items-center gap-2"><TypeBadge type={row.transactionType} /><span className="text-xs text-[#89968d]">{formatDate(row.tradeDate)}</span></div><p className="mt-1 truncate font-semibold text-[#25322b]">{row.partyName}</p><p className="mt-0.5 text-xs text-[#7c8981]">{formatWeight(row)} · Rate {formatNumber(row.rate)}</p></div><div className="flex items-center gap-2"><p className="whitespace-nowrap text-sm font-bold text-[#25322b]">{formatNumber(row.amount)}</p>{userRole === "admin" && <DeleteButton onClick={() => onRemove(row.id)} />}</div></div>;
}

function formatWeight(row: any) { return `${formatNumber(row.kyat)} ကျပ် ${formatNumber(row.pae)} ပဲ ${formatNumber(row.yway, 1)} ရွေး`; }
function TypeBadge({ type }: { type: string }) { return <Badge className={type === "sell" ? "border-0 bg-[#fff1df] text-[#a15f13]" : "border-0 bg-[#e7f5ea] text-[#2c6e49]"}>{type === "sell" ? "ရောင်း" : "ဝယ်"}</Badge>; }
function DeleteButton({ onClick }: { onClick: () => void }) { return <Button variant="ghost" size="icon" aria-label="Delete transaction" onClick={onClick} className="h-8 w-8 text-[#b16d65] hover:bg-[#fff1ef] hover:text-[#9c3b30]"><Trash2 className="h-4 w-4" /></Button>; }
function SummaryCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: "orange" | "green" | "purple" | "blue" }) { const tones = { orange: "bg-[#fff4e3] text-[#a15f13]", green: "bg-[#e8f5eb] text-[#2c6e49]", purple: "bg-[#f1ecfb] text-[#7651a8]", blue: "bg-[#e8f2fb] text-[#3e6f9e]" }; return <Card className="rounded-xl border-[#e1e9e4] shadow-sm"><CardContent className="p-3 sm:p-4"><div className="flex items-start justify-between gap-1.5"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#839087] sm:text-xs">{label}</p><p className="mt-1 truncate text-sm font-bold tracking-tight text-[#25322b] sm:text-lg">{value}</p><p className="mt-0.5 truncate text-[10px] text-[#839087] sm:text-xs">{detail}</p></div><div className={`shrink-0 rounded-lg p-2 sm:rounded-xl sm:p-2.5 ${tones[tone]}`}>{icon}</div></div></CardContent></Card>; }
function WeightInput({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) { return <div className="relative"><Input type="number" min="0" step={step} placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[#89968d]">{label}</span></div>; }
