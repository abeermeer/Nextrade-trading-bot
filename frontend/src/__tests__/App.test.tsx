import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe("App", () => {
  it("renders landing page on root route", async () => {
    window.history.pushState({}, "", "/");
    renderApp();
    expect((await screen.findAllByText(/NexTrade AI/i)).length).toBeGreaterThan(0);
  });
});
