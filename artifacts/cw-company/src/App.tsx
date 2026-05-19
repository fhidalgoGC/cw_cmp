import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Bookings from "@/pages/Bookings";
import BookingDetail from "@/pages/BookingDetail";
import Schedule from "@/pages/Schedule";
import Packages from "@/pages/Packages";
import Services from "@/pages/Services";
import Earnings from "@/pages/Earnings";
import Profile from "@/pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user && location !== "/login") {
      navigate("/login", { replace: true });
    }
    if (!loading && user && user.role !== "company") {
      // Only company users can use this app
      navigate("/login", { replace: true });
    }
    if (!loading && user && user.role === "company" && location === "/login") {
      navigate("/", { replace: true });
    }
  }, [loading, user, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      {!user ? null : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/bookings" component={Bookings} />
          <Route path="/bookings/:id">{(params) => <BookingDetail id={params.id} />}</Route>
          <Route path="/schedule" component={Schedule} />
          <Route path="/packages" component={Packages} />
          <Route path="/services" component={Services} />
          <Route path="/earnings" component={Earnings} />
          <Route path="/profile" component={Profile} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedRoutes />
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
