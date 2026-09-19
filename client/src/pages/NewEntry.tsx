import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CheckCircle2, Plus, RefreshCcw, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value || 0);
const emptyForm = { tradeDate: today(), transactionType: "sell" as "sell" | "buy", partyName: "", itemName: "", kyat: "", pae: "", yway: "", rate: "", note: "" };
type FormState = typeof emptyForm;

export default function NewEntry() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showOptional, setShowOptional] = useState(false);
  const utils = trpc.useUtils();
  const createMutation = trpc.ledger.create.useMutation({
    onSuccess: () => {
      toast.success("စာရင်းသွင်းပြီးပါပြီ");
      setForm({ ...emptyForm, tradeDate: form.tradeDate, transactionType: form.transactionType });
      void utils.ledger.list.invalidate();
      void utils.ledger.summary.invalidate();
    },
    onError: (error) => toast.error(error.message || "စာရင်းသွင်းရာတွင် အမှားရှိပါသည်"),
  });
  const update = (key: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const weight = Number(form.kyat || 0) + Number(form.pae || 0) / 16 + Number(form.yway || 0) / 128;
  const calculatedAmount = Math.round(weight * Number(form.rate || 0));
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

  return <div className="min-h-screen bg-[#f7f9f8] text-[#17201d] -m-2 p-3 sm:-m-4 sm:p-4 md:p-6"><div className="mx-auto max-w-[980px] space-y-5"><header className="border-b border-[#e4ebe6] pb-4"><p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">New transaction</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">စာရင်းအသစ် ထည့်ရန်</h1><p className="mt-1 text-sm text-[#68756d]">ဝယ်/ရောင်း အချက်အလက်များကို ဖြည့်ပြီး စာရင်းသွင်းပါ။</p></header><Card className="overflow-hidden rounded-2xl border-[#dfe8e2] shadow-sm"><CardHeader className="border-b border-[#edf1ee] bg-white px-4 py-5 sm:px-7"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-xl">အရောင်းအဝယ် အချက်အလက်</CardTitle><p className="mt-1 text-sm text-[#78867e]">* အမှတ်အသားပါသော field များကို မဖြစ်မနေဖြည့်ပါ။</p></div><div className="rounded-xl bg-[#e8f5eb] p-3 text-[#2c6e49]"><Plus className="h-5 w-5" /></div></div></CardHeader><CardContent className="bg-white px-4 py-5 sm:px-7"><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-[180px_200px_1fr]"><div className="space-y-1.5"><Label>နေ့စွဲ</Label><Input type="date" value={form.tradeDate} onChange={(e) => update("tradeDate", e.target.value)} /></div><div className="space-y-1.5"><Label>အမျိုးအစား</Label><Tabs value={form.transactionType} onValueChange={(value) => update("transactionType", value)}><TabsList className="grid w-full grid-cols-2 bg-[#eef4ef]"><TabsTrigger value="sell" className="data-[state=active]:bg-[#fff3e2] data-[state=active]:text-[#a15f13]">ရောင်း</TabsTrigger><TabsTrigger value="buy" className="data-[state=active]:bg-[#e8f5eb] data-[state=active]:text-[#2c6e49]">ဝယ်</TabsTrigger></TabsList></Tabs></div><div className="space-y-1.5"><Label>ဝယ်သူ / ရောင်းသူ အမည် <span className="text-[#b84b3e]">*</span></Label><Input autoFocus placeholder="ဥပမာ - ကိုဖိုးထူး" value={form.partyName} onChange={(e) => update("partyName", e.target.value)} /></div></div><div><Label className="mb-1.5 block">အလေးချိန် <span className="text-[#b84b3e]">*</span></Label><div className="grid grid-cols-3 gap-2"><WeightInput label="ကျပ်" value={form.kyat} onChange={(value) => update("kyat", value)} /><WeightInput label="ပဲ" value={form.pae} onChange={(value) => update("pae", value)} /><WeightInput label="ရွေး" value={form.yway} onChange={(value) => update("yway", value)} step="0.1" /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Rate (ကျပ်) <span className="text-[#b84b3e]">*</span></Label><Input type="number" min="0" placeholder="10,000,000" value={form.rate} onChange={(e) => update("rate", e.target.value)} /></div><div className="flex items-center justify-between rounded-xl border border-[#dcebe0] bg-[#f4faf5] px-4 py-3"><div><p className="text-xs text-[#68756d]">တွက်ချက်ထားသော Amount</p><p className="text-xl font-bold text-[#1f5e3a]">{formatNumber(calculatedAmount)} ကျပ်</p></div><CheckCircle2 className="h-6 w-6 text-[#63a878]" /></div></div><div className="border-t border-[#edf1ee] pt-4"><button type="button" onClick={() => setShowOptional((value) => !value)} className="flex items-center gap-2 text-sm font-medium text-[#53645b] hover:text-[#276044]"><Settings2 className="h-4 w-4" /> Optional details {showOptional ? "ဖျောက်မည်" : "ထည့်မည်"}</button>{showOptional && <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>ပစ္စည်းအမည်</Label><Input placeholder="ဥပမာ - ရွှေလက်ကောက်" value={form.itemName} onChange={(e) => update("itemName", e.target.value)} /></div><div className="space-y-1.5"><Label>မှတ်ချက်</Label><Input placeholder="မှတ်ချက်ထည့်ရန်" value={form.note} onChange={(e) => update("note", e.target.value)} /></div></div>}</div><Button type="submit" disabled={createMutation.isPending} className="h-12 w-full rounded-xl bg-[#276044] text-white hover:bg-[#1f5038] sm:w-auto sm:px-10">{createMutation.isPending ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}စာရင်းသွင်းမည်</Button></form></CardContent></Card><p className="flex items-center gap-2 text-xs text-[#8a958e]"><CalendarDays className="h-3.5 w-3.5" /> စာရင်းသွင်းပြီးပါက နေ့စဉ်စာရင်း Tab ထဲတွင် ပြန်ကြည့်နိုင်ပါသည်။</p></div></div>;
}

function WeightInput({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) { return <div className="relative"><Input type="number" min="0" step={step} placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[#89968d]">{label}</span></div>; }
