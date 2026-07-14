import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";

const ReviewCockpit = lazy(() =>
  import("./components/ReviewCockpit").then((m) => ({ default: m.ReviewCockpit })),
);
const AuditTrail = lazy(() =>
  import("./components/AuditTrail").then((m) => ({ default: m.AuditTrail })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 3000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 2000,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense>
            <Routes>
              <Route path="/" element={<ReviewCockpit />} />
              <Route path="/audit" element={<AuditTrail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster position="bottom-right" richColors closeButton />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
