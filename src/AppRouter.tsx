import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { TopBar } from "./components/TopBar";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Edit from "./pages/Edit";
import { UserPage } from "./pages/UserPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      {/* Fixed, so every route below is offset by the bar's height rather than
          each page having to account for it. */}
      <TopBar />
      <div className="pt-[var(--ys-bar)]">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/edit" element={<Edit />} />
          {/*
            Someone's page, addressed however they're known: an npub, a NIP-05
            like `alex@gleasonator.com`, or a bare domain like `soapbox.pub`.
          */}
          <Route path="/:user" element={<UserPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
export default AppRouter;
