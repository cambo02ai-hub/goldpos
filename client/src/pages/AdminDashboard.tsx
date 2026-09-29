import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSION_LEVELS,
  EMPLOYEE_PERMISSION_MODULES,
  type EmployeePermissionLevel,
  type EmployeePermissionModule,
  type EmployeePermissions,
} from "@shared/permissions";
import { Crown, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

const levelLabels: Record<EmployeePermissionLevel, string> = {
  none: "ခွင့်မရှိ",
  view: "ကြည့်ရန်သာ",
  write: "ကြည့် / ထည့်ရန်",
  manage: "အပြည့် (ဖျက်ခွင့်ပါ)",
};

const moduleLabel = Object.fromEntries(
  EMPLOYEE_PERMISSION_MODULES.map(item => [item.key, item.label])
) as Record<EmployeePermissionModule, string>;

function blankPermissions(): EmployeePermissions {
  return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
}

type CreateForm = {
  name: string;
  username: string;
  email: string;
  password: string;
  permissions: EmployeePermissions;
};

type EditForm = {
  id: number;
  name: string;
  email: string;
  password: string;
  permissions: EmployeePermissions;
  isActive: boolean;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    username: "",
    email: "",
    password: "",
    permissions: blankPermissions(),
  });
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const employeesQuery = trpc.admin.employees.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const refreshEmployees = () => {
    void utils.admin.employees.invalidate();
    void utils.admin.users.invalidate();
  };

  const createMutation = trpc.admin.createEmployee.useMutation({
    onSuccess: () => {
      toast.success("ဝန်ထမ်း account ဖန်တီးပြီးပါပြီ");
      setCreateForm({
        name: "",
        username: "",
        email: "",
        password: "",
        permissions: blankPermissions(),
      });
      refreshEmployees();
    },
    onError: error => toast.error(error.message || "Account ဖန်တီး၍မရပါ"),
  });

  const updateMutation = trpc.admin.updateEmployee.useMutation({
    onSuccess: () => {
      toast.success("ဝန်ထမ်း account ပြင်ဆင်ပြီးပါပြီ");
      setEditForm(null);
      refreshEmployees();
    },
    onError: error => toast.error(error.message || "Account ပြင်ဆင်၍မရပါ"),
  });

  const employees = employeesQuery.data ?? [];
  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter(employee =>
      `${employee.name ?? ""} ${employee.username} ${employee.email ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [employees, search]);

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md rounded-3xl border-[#e1e9e4] text-center shadow-sm">
          <CardContent className="p-10">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#b16d65]" />
            <h1 className="mt-4 text-xl font-semibold">
              Admin access လိုအပ်ပါသည်
            </h1>
            <p className="mt-2 text-sm text-[#78867e]">
              ဝန်ထမ်း account များကို Admin များသာ စီမံနိုင်ပါသည်။
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate({
      name: createForm.name.trim(),
      username: createForm.username.trim(),
      email: createForm.email.trim() || null,
      password: createForm.password,
      permissions: createForm.permissions,
    });
  };

  const openEditor = (employee: (typeof employees)[number]) => {
    setEditForm({
      id: employee.id,
      name: employee.name ?? "",
      email: employee.email ?? "",
      password: "",
      permissions: employee.permissions ?? blankPermissions(),
      isActive: employee.isActive,
    });
  };

  const onUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm) return;
    updateMutation.mutate({
      id: editForm.id,
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      permissions: editForm.permissions,
      isActive: editForm.isActive,
      ...(editForm.password ? { password: editForm.password } : {}),
    });
  };

  const activeCount = employees.filter(employee => employee.isActive).length;

  return (
    <div className="-m-2 min-h-screen bg-[#f6f8f7] p-4 text-[#17201d] sm:-m-4 md:p-8">
      <div className="mx-auto max-w-[1280px] space-y-7">
        <header>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#a06c18]">
            <Crown className="h-4 w-4" /> Owner control center
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-[#63716b]">
            ဝန်ထမ်းအကောင့်များ ဖန်တီးပြီး စာရင်းကဏ္ဍအလိုက် အသုံးပြုခွင့်ကို
            သတ်မှတ်ပါ။
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric
            icon={<Users className="h-5 w-5" />}
            label="ဝန်ထမ်းစုစုပေါင်း"
            value={String(employees.length)}
            tone="green"
          />
          <Metric
            icon={<UserCog className="h-5 w-5" />}
            label="အသုံးပြုခွင့် ဖွင့်ထားသူ"
            value={String(activeCount)}
            tone="purple"
          />
          <Metric
            icon={<ShieldCheck className="h-5 w-5" />}
            label="ပိတ်ထားသူ"
            value={String(employees.length - activeCount)}
            tone="orange"
          />
        </section>

        <Card className="rounded-3xl border-[#e1e9e4] shadow-sm">
          <CardHeader className="border-b border-[#edf1ee] bg-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c6e49]">
              New employee
            </p>
            <CardTitle className="mt-1 text-xl">
              ဝန်ထမ်း account အသစ်ဖန်တီးရန်
            </CardTitle>
            <p className="text-sm text-[#78867e]">
              စတင်ဝင်ရောက်ရန် password ကို ဝန်ထမ်းထံ သီးသန့်ပေးပါ။ Password ကို
              database တွင် hash လုပ်၍ သိမ်းဆည်းပါသည်။
            </p>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            <form onSubmit={onCreate} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="ဝန်ထမ်းအမည်">
                  <Input
                    required
                    minLength={2}
                    maxLength={255}
                    value={createForm.name}
                    onChange={event =>
                      setCreateForm({ ...createForm, name: event.target.value })
                    }
                    placeholder="အမည်အပြည့်အစုံ"
                  />
                </Field>
                <Field label="Username (ဝင်ရန်အမည်)">
                  <Input
                    required
                    minLength={3}
                    maxLength={64}
                    pattern="[A-Za-z0-9._@+-]+"
                    autoComplete="off"
                    value={createForm.username}
                    onChange={event =>
                      setCreateForm({
                        ...createForm,
                        username: event.target.value,
                      })
                    }
                    placeholder="ဥပမာ employee01"
                  />
                </Field>
                <Field label="Email (မဖြစ်မနေမဟုတ်ပါ)">
                  <Input
                    type="email"
                    maxLength={320}
                    value={createForm.email}
                    onChange={event =>
                      setCreateForm({
                        ...createForm,
                        email: event.target.value,
                      })
                    }
                    placeholder="employee@example.com"
                  />
                </Field>
                <Field label="စတင်အသုံးပြုမည့် Password">
                  <Input
                    type="password"
                    required
                    minLength={10}
                    maxLength={200}
                    autoComplete="new-password"
                    value={createForm.password}
                    onChange={event =>
                      setCreateForm({
                        ...createForm,
                        password: event.target.value,
                      })
                    }
                    placeholder="အနည်းဆုံး ၁၀ လုံး"
                  />
                </Field>
              </div>

              <PermissionFields
                permissions={createForm.permissions}
                onChange={permissions =>
                  setCreateForm({ ...createForm, permissions })
                }
              />

              <div className="flex flex-col gap-2 border-t border-[#edf1ee] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#78867e]">
                  Admin panel နှင့် အခြား employee account စီမံခွင့်ကို
                  ဝန်ထမ်းများထံ မပေးနိုင်ပါ။
                </p>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-[#276044] text-white hover:bg-[#1f5038]"
                >
                  {createMutation.isPending
                    ? "ဖန်တီးနေပါသည်…"
                    : "ဝန်ထမ်းအကောင့် ဖန်တီးမည်"}
                </Button>
              </div>
            </form>
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
                  ဝန်ထမ်းအကောင့်များနှင့် ခွင့်ပြုချက်များ
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
                    <th className="px-5 py-3">ဝန်ထမ်း</th>
                    <th className="px-4 py-3">Username / Email</th>
                    <th className="px-4 py-3">ခွင့်ပြုချက်များ</th>
                    <th className="px-4 py-3">အခြေအနေ</th>
                    <th className="px-4 py-3">နောက်ဆုံးဝင်ချိန်</th>
                    <th className="px-5 py-3 text-right">လုပ်ဆောင်ချက်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ee]">
                  {employeesQuery.isLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-[#839087]"
                      >
                        ဝန်ထမ်းစာရင်းကို ဖတ်နေပါသည်…
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-[#839087]"
                      >
                        ဝန်ထမ်းအကောင့် မတွေ့ပါ
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(employee => (
                      <tr key={employee.id} className="hover:bg-[#fbfdfb]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3ed] font-semibold text-[#2c6e49]">
                              {employee.name?.charAt(0) || "E"}
                            </div>
                            <span className="font-semibold">
                              {employee.name || "အမည်မရှိ"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium">{employee.username}</p>
                          <p className="mt-1 text-xs text-[#78867e]">
                            {employee.email || "Email မထည့်ထားပါ"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <PermissionSummary
                            permissions={
                              employee.permissions ?? blankPermissions()
                            }
                          />
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            className={
                              employee.isActive
                                ? "border-0 bg-[#e8f5eb] text-[#2c6e49]"
                                : "border-0 bg-[#fff0ee] text-[#a0443b]"
                            }
                          >
                            {employee.isActive ? "အသုံးပြုနိုင်" : "ပိတ်ထားသည်"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-xs text-[#78867e]">
                          {employee.lastSignedIn
                            ? new Date(employee.lastSignedIn).toLocaleString(
                                "my-MM"
                              )
                            : "—"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditor(employee)}
                          >
                            ပြင်ဆင်ရန်
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(editForm)}
        onOpenChange={open => !open && setEditForm(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ဝန်ထမ်းအကောင့် ပြင်ဆင်ရန်</DialogTitle>
            <DialogDescription>
              ခွင့်ပြုချက်ပြောင်းလဲပါ၊ account ပိတ်ပါ သို့မဟုတ် password အသစ်
              သတ်မှတ်ပါ။
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={onUpdate} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ဝန်ထမ်းအမည်">
                  <Input
                    required
                    minLength={2}
                    maxLength={255}
                    value={editForm.name}
                    onChange={event =>
                      setEditForm({ ...editForm, name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Email (မဖြစ်မနေမဟုတ်ပါ)">
                  <Input
                    type="email"
                    maxLength={320}
                    value={editForm.email}
                    onChange={event =>
                      setEditForm({ ...editForm, email: event.target.value })
                    }
                  />
                </Field>
                <Field label="Password အသစ် (မပြောင်းလိုပါက ဗလာထားပါ)">
                  <Input
                    type="password"
                    minLength={10}
                    maxLength={200}
                    autoComplete="new-password"
                    value={editForm.password}
                    onChange={event =>
                      setEditForm({ ...editForm, password: event.target.value })
                    }
                    placeholder="အနည်းဆုံး ၁၀ လုံး"
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-xl border border-[#dfe8e2] px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={event =>
                      setEditForm({
                        ...editForm,
                        isActive: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#276044]"
                  />
                  Account အသုံးပြုခွင့် ဖွင့်ထားမည်
                </label>
              </div>
              <PermissionFields
                permissions={editForm.permissions}
                onChange={permissions =>
                  setEditForm({ ...editForm, permissions })
                }
              />
              <div className="flex justify-end gap-2 border-t border-[#edf1ee] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditForm(null)}
                >
                  ပယ်မည်
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-[#276044] text-white hover:bg-[#1f5038]"
                >
                  {updateMutation.isPending ? "သိမ်းနေပါသည်…" : "သိမ်းမည်"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PermissionFields({
  permissions,
  onChange,
}: {
  permissions: EmployeePermissions;
  onChange: (permissions: EmployeePermissions) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">ဝန်ထမ်း၏ အသုံးပြုခွင့်</h3>
        <p className="mt-1 text-xs text-[#78867e]">
          “ထည့်ရန်” သည် ကြည့်ခွင့်ပါဝင်ပြီး၊ “အပြည့်” တွင် ဖျက်ခွင့်ပါ ပါဝင်သည်။
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {EMPLOYEE_PERMISSION_MODULES.map(module => (
          <div
            key={module.key}
            className="space-y-2 rounded-xl border border-[#dfe8e2] bg-[#fbfdfb] p-4"
          >
            <Label>{module.label}</Label>
            <Select
              value={permissions[module.key]}
              onValueChange={value =>
                onChange({
                  ...permissions,
                  [module.key]: value as EmployeePermissionLevel,
                })
              }
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_PERMISSION_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>
                    {levelLabels[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </section>
  );
}

function PermissionSummary({
  permissions,
}: {
  permissions: EmployeePermissions;
}) {
  const granted = EMPLOYEE_PERMISSION_MODULES.filter(
    module => permissions[module.key] !== "none"
  );
  if (granted.length === 0) {
    return (
      <span className="text-xs text-[#89968d]">ခွင့်ပြုချက် မပေးထားပါ</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {granted.map(module => (
        <Badge
          key={module.key}
          variant="outline"
          className="border-[#dfe8e2] bg-white text-xs text-[#53645b]"
        >
          {moduleLabel[module.key]} · {levelLabels[permissions[module.key]]}
        </Badge>
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
