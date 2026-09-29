import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminDashboard from "./pages/AdminDashboard";
import Finance from "./pages/Finance";
import Home from "./pages/Home";
import NewEntry from "./pages/NewEntry";
import ShopWorkflow from "./pages/ShopWorkflow";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <DashboardLayout
          requiredPermission={{ module: "ledger", level: "view" }}
        >
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/new">
        <DashboardLayout
          requiredPermission={{ module: "ledger", level: "write" }}
        >
          <NewEntry />
        </DashboardLayout>
      </Route>
      <Route path="/finance">
        <DashboardLayout
          requiredPermission={{ module: "finance", level: "view" }}
        >
          <Finance />
        </DashboardLayout>
      </Route>
      <Route path="/shop-book">
        <DashboardLayout
          requiredPermission={{ module: "shopBook", level: "view" }}
        >
          <ShopWorkflow />
        </DashboardLayout>
      </Route>
      <Route path="/admin">
        <DashboardLayout>
          <AdminDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
