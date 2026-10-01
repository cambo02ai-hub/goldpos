import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Crown,
  KeyRound,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Permission = "dashboard" | "ledger" | "finance" | "shopBook" | "hlawOo";
const permissionOptions: { key: Permission; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "ledger", label: "အရောင်း / အဝယ်" },
  { key: "finance", label: "ငွေစာရင်း" },
  { key: "shopBook", label: "ဆိုင်စာရင်းအုပ်" },
  { key: "hlawOo", label: "လှော်အိုး" },
];
const defaultPermissions: Permission[] = permissionOptions.map(
  option => option.key
);

function readPermissions(
  value: string | string[] | null | undefined
): Permission[] {
  if (!value) return defaultPermissions;
  if (Array.isArray(value))
    return permissionOptions
      .map(option => option.key)
      .filter(key => value.includes(key));
  try {
    const parsed = JSON.parse(value);
    return permissionOptions
      .map(option => option.key)
      .filter(key => parsed.includes(key));
  } catch {
    return [];
  }
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ username: "", name: "", password: "" });
  const [newPermissions, setNewPermissions] =
    useState<Permission[]>(defaultPermissions);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Permission[]>(
    []
  );
  const usersQuery = trpc.admin.users.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const utils = trpc.useUtils();
  const createEmployee = trpc.admin.createEmployee.useMutation({
    onSuccess: () => {
      toast.success("Employee account ဖန်တီးပြီးပါပြီ");
      setForm({ username: "", name: "", password: "" });
      setNewPermissions(defaultPermissions);
      void utils.admin.users.invalidate();
    },
    onError: error => toast.error(error.message || "Account ဖန်တီး၍ မရပါ"),
  });
  const setPermissions = trpc.admin.setPermissions.useMutation({
    onSuccess: () => {
      toast.success("Employee permission ပြင်ပြီးပါပြီ");
      setEditingId(null);
      void utils.admin.users.invalidate();
    },
    onError: error => toast.error(error.message || "Permission ပြင်၍ မရပါ"),
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      toast.success("အသုံးပြုသူ role ပြောင်းပြီးပါပြီ");
      void utils.admin.users.invalidate();
    },
    onError: error => toast.error(error.message || "လုပ်ဆောင်၍မရပါ"),
  });
  const users = (usersQuery.data ?? []).filter(entry =>
    `${entry.name ?? ""} ${entry.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const toggle = (list: Permission[], key: Permission) =>
    list.includes(key) ? list.filter(item => item !== key) : [...list, key];

  if (user?.role !== "admin")
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md rounded-3xl border-[#e1e9e4] text-center shadow-sm">
          <CardContent className="p-10">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#b16d65]" />
            <h1 className="mt-4 text-xl font-semibold">
              Admin access လိုအပ်ပါသည်
            </h1>
            <p className="mt-2 text-sm text-[#78867e]">
              ဤစာမျက်နှာကို Admin Owner များသာ အသုံးပြုနိုင်ပါသည်။
            </p>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-[#17201d] -m-4 p-4 md:p-8">
      <div className="mx-auto max-w-[1280px] space-y-7">
        <header>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#a06c18]">
            <Crown className="h-4 w-4" /> Owner control center
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-[#63716b]">
            ဝန်ထမ်းအကောင့်များ ဖန်တီးပြီး စာရင်းအသုံးပြုခွင့်များကို စီမံပါ။
          </p>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          <Metric
            icon={<Users className="h-5 w-5" />}
            label="စုစုပေါင်းအသုံးပြုသူ"
            value={String(usersQuery.data?.length ?? 0)}
            tone="green"
          />
          <Metric
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Admin Owner"
            value={String(
              (usersQuery.data ?? []).filter(entry => entry.role === "admin")
                .length
            )}
            tone="purple"
          />
          <Metric
            icon={<UserCog className="h-5 w-5" />}
            label="Employee"
            value={String(
              (usersQuery.data ?? []).filter(entry => entry.role === "user")
                .length
            )}
            tone="orange"
          />
        </section>
        <Card className="rounded-3xl border-[#e1e9e4] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] bg-white">
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-[#2c6e49]" /> Employee account
              အသစ်ဖန်တီးရန်
            </CardTitle>
            <p className="text-sm text-[#78867e]">
              Employee သည် ရွေးချယ်ပေးထားသော စာရင်းများကိုသာ အသုံးပြုနိုင်ပါမည်။
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Username (ဥပမာ: kyawkyaw)"
                value={form.username}
                onChange={event =>
                  setForm({ ...form, username: event.target.value })
                }
              />
              <Input
                placeholder="ဝန်ထမ်းအမည်"
                value={form.name}
                onChange={event =>
                  setForm({ ...form, name: event.target.value })
                }
              />
              <Input
                type="password"
                placeholder="Password (အနည်းဆုံး 8 လုံး)"
                value={form.password}
                onChange={event =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </div>
            <PermissionPicker
              value={newPermissions}
              onChange={setNewPermissions}
            />
            <Button
              disabled={createEmployee.isPending || newPermissions.length === 0}
              onClick={() =>
                createEmployee.mutate({ ...form, permissions: newPermissions })
              }
              className="bg-[#276044] text-white hover:bg-[#1f5038]"
            >
              {createEmployee.isPending
                ? "ဖန်တီးနေပါသည်…"
                : "Employee account ဖန်တီးမည်"}
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-[#e1e9e4] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] bg-white">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c6e49]">
                  Account management
                </p>
                <CardTitle className="mt-1 text-xl">
                  အသုံးပြုသူ အကောင့်များ
                </CardTitle>
              </div>
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9aa79f]" />
                <Input
                  className="pl-9"
                  placeholder="အမည် / username ရှာရန်"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#f8faf8] text-left text-xs uppercase tracking-wide text-[#748079]">
                  <tr>
                    <th className="px-6 py-3">အသုံးပြုသူ</th>
                    <th className="px-4 py-3">လက်ရှိ Role</th>
                    <th className="px-4 py-3">ခွင့်ပြုထားသော စာရင်း</th>
                    <th className="px-4 py-3">နောက်ဆုံးဝင်ရောက်မှု</th>
                    <th className="px-6 py-3 text-right">လုပ်ဆောင်ချက်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ee]">
                  {usersQuery.isLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-[#839087]"
                      >
                        အသုံးပြုသူများ ဖတ်နေပါသည်…
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-[#839087]"
                      >
                        အသုံးပြုသူ မတွေ့ပါ
                      </td>
                    </tr>
                  ) : (
                    users.map(entry => {
                      const permissions =
                        editingId === entry.id
                          ? editingPermissions
                          : readPermissions(entry.permissions);
                      return (
                        <tr key={entry.id} className="hover:bg-[#fbfdfb]">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ed] font-semibold text-[#2c6e49]">
                                {entry.name?.charAt(0) || "U"}
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {entry.name || "အမည်မရှိ"}
                                </p>
                                <p className="text-xs text-[#78867e]">
                                  {entry.email || entry.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              className={
                                entry.role === "admin"
                                  ? "border-0 bg-[#f1ecfb] text-[#7651a8]"
                                  : "border-0 bg-[#e8f5eb] text-[#2c6e49]"
                              }
                            >
                              {entry.role === "admin"
                                ? "Admin Owner"
                                : "Employee"}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            {entry.role === "admin" ? (
                              <span className="text-xs text-[#78867e]">
                                အားလုံး
                              </span>
                            ) : editingId === entry.id ? (
                              <PermissionPicker
                                compact
                                value={permissions}
                                onChange={setEditingPermissions}
                              />
                            ) : (
                              <div className="flex max-w-[340px] flex-wrap gap-1">
                                {permissions.map(key => (
                                  <Badge
                                    key={key}
                                    variant="outline"
                                    className="border-[#d5e4d8] text-xs text-[#2c6e49]"
                                  >
                                    {
                                      permissionOptions.find(
                                        option => option.key === key
                                      )?.label
                                    }
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-[#78867e]">
                            {entry.lastSignedIn
                              ? new Date(entry.lastSignedIn).toLocaleString(
                                  "my-MM"
                                )
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {entry.role === "user" &&
                                (editingId === entry.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      disabled={
                                        setPermissions.isPending ||
                                        permissions.length === 0
                                      }
                                      onClick={() =>
                                        setPermissions.mutate({
                                          id: entry.id,
                                          permissions,
                                        })
                                      }
                                      className="bg-[#276044] text-white"
                                    >
                                      သိမ်းမည်
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingId(null)}
                                    >
                                      မလုပ်တော့
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingId(entry.id);
                                      setEditingPermissions(
                                        readPermissions(entry.permissions)
                                      );
                                    }}
                                  >
                                    Permission ပြင်မည်
                                  </Button>
                                ))}
                              {entry.id !== user.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={setRole.isPending}
                                  onClick={() =>
                                    setRole.mutate({
                                      id: entry.id,
                                      role:
                                        entry.role === "admin"
                                          ? "user"
                                          : "admin",
                                    })
                                  }
                                >
                                  {entry.role === "admin"
                                    ? "Employee ပြောင်း"
                                    : "Admin ပြောင်း"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PermissionPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Permission[];
  onChange: (value: Permission[]) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "max-w-[320px]" : ""}`}>
      {permissionOptions.map(option => (
        <label
          key={option.key}
          className="flex items-center gap-1.5 rounded-lg border border-[#dfe8e2] bg-[#fbfdfb] px-2.5 py-1.5 text-xs text-[#53645b]"
        >
          <input
            type="checkbox"
            checked={value.includes(option.key)}
            onChange={() =>
              onChange(
                value.includes(option.key)
                  ? value.filter(key => key !== option.key)
                  : [...value, option.key]
              )
            }
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "purple" | "orange";
}) {
  const colors = {
    green: "bg-[#e8f5eb] text-[#2c6e49]",
    purple: "bg-[#f1ecfb] text-[#7651a8]",
    orange: "bg-[#fff4e3] text-[#a15f13]",
  };
  return (
    <Card className="rounded-3xl border-[#e1e9e4] shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#839087]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${colors[tone]}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
