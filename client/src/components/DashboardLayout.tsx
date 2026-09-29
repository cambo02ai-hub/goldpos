import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  hasEmployeePermission,
  type EmployeePermissionLevel,
  type EmployeePermissionModule,
} from "@shared/permissions";
import {
  BookOpenCheck,
  CalendarCheck2,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
  requiredPermission,
}: {
  children: React.ReactNode;
  requiredPermission?: {
    module: EmployeePermissionModule;
    level: Exclude<EmployeePermissionLevel, "none">;
  };
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) return <LocalLoginForm />;

  const pageDenied =
    requiredPermission &&
    !hasEmployeePermission(
      user,
      requiredPermission.module,
      requiredPermission.level
    );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {pageDenied ? <PermissionDenied /> : children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function LocalLoginForm() {
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="mobile-app-login flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f9f8] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-[#dfe8e2] bg-white p-7 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a06c18]">
            Ratanar Maung Gold House
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#17201d]">
            ဝင်ရောက်ရန်
          </h1>
          <p className="text-sm text-[#68756d]">
            GoldPOS စနစ်ကို အသုံးပြုရန် သင့်အကောင့်ဖြင့် ဝင်ရောက်ပါ။
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </div>
        </div>
        {loginMutation.error && (
          <p className="text-sm text-red-600">
            Username သို့မဟုတ် password မှားယွင်းနေပါသည်။
          </p>
        )}
        <Button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full bg-[#276044] text-white hover:bg-[#1f5038]"
        >
          {loginMutation.isPending ? "ဝင်ရောက်နေပါသည်…" : "ဝင်ရောက်မည်"}
        </Button>
      </form>
      <IOSInstallHint />
    </div>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const menuItems = [
    ...(hasEmployeePermission(user, "ledger", "view")
      ? [{ icon: LayoutDashboard, label: "နေ့စဉ်စာရင်း", path: "/" }]
      : []),
    ...(hasEmployeePermission(user, "ledger", "write")
      ? [{ icon: FilePlus2, label: "စာရင်းအသစ် ထည့်ရန်", path: "/new" }]
      : []),
    ...(hasEmployeePermission(user, "finance", "view")
      ? [
          {
            icon: BookOpenCheck,
            label: "ငွေစာရင်း / အစီရင်ခံစာ",
            path: "/finance",
          },
        ]
      : []),
    ...(hasEmployeePermission(user, "shopBook", "view")
      ? [{ icon: CalendarCheck2, label: "ဆိုင်စာရင်းအုပ်", path: "/shop-book" }]
      : []),
    ...(user?.role === "admin"
      ? [{ icon: Users, label: "Admin Dashboard", path: "/admin" }]
      : []),
  ];
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    ရွှေစာရင်း
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="ios-safe-footer p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || user?.openId || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="mobile-app-header flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="mobile-app-main flex-1 p-2 sm:p-3 md:p-4">
          <IOSInstallHint />
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

function IOSInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("goldpos-ios-install-hint-dismissed")) {
        return;
      }
    } catch {
      // Installation guidance can still be displayed if storage is unavailable.
    }

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isIOS =
      /iPhone|iPad|iPod/i.test(nav.userAgent) ||
      (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    const isStandalone =
      nav.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches === true;
    setVisible(isIOS && !isStandalone);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.sessionStorage.setItem("goldpos-ios-install-hint-dismissed", "1");
    } catch {
      // The close button remains functional without session storage.
    }
  };

  if (!visible) return null;

  return (
    <aside
      className="mb-3 flex items-start gap-3 rounded-xl border border-[#d8e7db] bg-[#eef6ef] px-3 py-3 text-sm text-[#244832] sm:px-4"
      role="note"
    >
      <Smartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">iPhone / iPad မှာ app လို ထည့်သုံးရန်</p>
        <p className="mt-1 text-xs leading-relaxed text-[#53645b]">
          Safari ထဲက Share ခလုတ်ကိုနှိပ်ပြီး “Add to Home Screen” → “Add”
          ကိုရွေးပါ။ အသုံးပြုရန် အင်တာနက်လိုအပ်ပါသည်။
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 -mt-1 rounded-md p-1 text-[#53645b] hover:bg-[#dfeee2]"
        aria-label="Install ညွှန်ကြားချက် ပိတ်ရန်"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}

function PermissionDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-[#e1e9e4] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">ဝင်ရောက်ခွင့် မရှိပါ</h1>
        <p className="mt-2 text-sm text-[#78867e]">
          ဤစာမျက်နှာကို အသုံးပြုရန် Admin ထံမှ သက်ဆိုင်ရာ permission တောင်းခံပါ။
        </p>
      </div>
    </div>
  );
}
