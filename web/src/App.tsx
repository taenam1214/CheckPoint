import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { ReviewCockpit } from "./components/ReviewCockpit";
import { AuditTrail } from "./components/AuditTrail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 3000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ReviewCockpit />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
