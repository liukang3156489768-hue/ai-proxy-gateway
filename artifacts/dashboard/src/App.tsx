import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { RootLayout } from "@/components/layout";
import Home from "@/pages/home";
import Stats from "@/pages/stats";
import Logs from "@/pages/logs";
import Models from "@/pages/models";
import Monitor from "@/pages/monitor";
import Settings from "@/pages/settings";
import Keys from "@/pages/keys";
import Deploy from "@/pages/deploy";
import Tech from "@/pages/tech";
import Docs from "@/pages/docs";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <RootLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/stats" component={Stats} />
        <Route path="/monitor" component={Monitor} />
        <Route path="/models" component={Models} />
        <Route path="/settings" component={Settings} />
        <Route path="/keys" component={Keys} />
        <Route path="/deploy" component={Deploy} />
        <Route path="/tech" component={Tech} />
        <Route path="/logs" component={Logs} />
        <Route path="/docs" component={Docs} />
        <Route component={NotFound} />
      </Switch>
    </RootLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
