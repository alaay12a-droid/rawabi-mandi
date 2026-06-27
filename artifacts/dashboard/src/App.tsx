import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Orders from "@/pages/orders";
import Login from "@/pages/login";
import Drivers from "@/pages/drivers";
import MenuManagement from "@/pages/menu-management";
import SalesReports from "@/pages/reports";
import MandoobPortal from "@/pages/mandoob";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/mandoob" component={MandoobPortal} />
      <Route path="/">
        <Layout>
          <Home />
        </Layout>
      </Route>
      <Route path="/orders">
        <Layout>
          <Orders />
        </Layout>
      </Route>
      <Route path="/drivers">
        <Layout>
          <Drivers />
        </Layout>
      </Route>
      <Route path="/menu">
        <Layout>
          <MenuManagement />
        </Layout>
      </Route>
      <Route path="/reports">
        <Layout>
          <SalesReports />
        </Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div dir="rtl" className="min-h-screen text-right font-sans antialiased bg-background text-foreground">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
