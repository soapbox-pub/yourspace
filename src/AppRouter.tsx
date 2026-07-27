import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import GrapesJSDemo from "./pages/builders/GrapesJSDemo";
import GrapesJSStudioDemo from "./pages/builders/GrapesJSStudioDemo";
import PuckDemo from "./pages/builders/PuckDemo";
import TiptapDemo from "./pages/builders/TiptapDemo";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/builders/puck" element={<PuckDemo />} />
        <Route path="/builders/tiptap" element={<TiptapDemo />} />
        <Route path="/builders/grapesjs" element={<GrapesJSDemo />} />
        <Route path="/builders/grapesjs-studio" element={<GrapesJSStudioDemo />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;