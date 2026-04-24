import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Lotteries from "./pages/Lotteries.tsx";
import LotteryDetail from "./pages/LotteryDetail.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import Navbar from "./components/Navbar.tsx";
import Footer from "./components/Footer.tsx";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./components/ui/button.tsx";
import { Link } from "react-router-dom";
import LotteryHistory from "./pages/LotteryHistory.tsx";
import Syndicates from "./pages/Syndicates.tsx";
import Results from "./pages/Results.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import GroupTicketDetail from "./pages/GroupTicketDetail.tsx";
import PaymentCallback from "./pages/PaymentCallback.tsx";
import Admin from "./pages/Admin.tsx";
import AdminLayout from "./components/admin/AdminLayout";
import DrawsManager from "./components/admin/DrawsManager";
import SyndicatesManager from "./components/admin/SyndicatesManager";
import { WithdrawalsManager } from "./components/admin/WithdrawalsManager";
import { WithdrawalConfigsManager } from "./components/admin/WithdrawalConfigsManager";
import { FxPairsManager } from "./components/admin/FxPairsManager";
import { KycManager } from "./components/admin/KycManager";
import { SocialReports } from "./components/admin/SocialReports";
import SyndicatePicksManager from "./components/admin/SyndicatePicksManager";
import LotteryBrandingManager from "./components/admin/LotteryBrandingManager";
import ContactSubmissions from "./components/admin/ContactSubmissions";
import SecretsAudit from "./components/admin/SecretsAudit";
import GitHubSyncStatus from "./components/admin/GitHubSyncStatus";
import Kyc from "./pages/Kyc.tsx";
import Contact from "./pages/Contact.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import ResponsiblePlay from "./pages/ResponsiblePlay.tsx";
import Cookies from "./pages/Cookies.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import FeedPage from "./pages/Feed.tsx";
import NotificationsPage from "./pages/Notifications.tsx";
import MessagesPage from "./pages/Messages.tsx";
import AddFunds from "./pages/AddFunds.tsx";
import Withdraw from "./pages/Withdraw.tsx";
import Transactions from "./pages/Transactions.tsx";
import MyProfile from "./pages/MyProfile.tsx";
import NotFound from "./pages/NotFound.tsx";
import ScrollToTop from "./components/ScrollToTop.tsx";
import { BottomNav } from "./components/BottomNav.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
          <WalletProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/lotteries" element={<Lotteries />} />
            <Route path="/lottery/:slug" element={<LotteryDetail />} />
            <Route path="/lotteries/:slug/history" element={<LotteryHistory />} />
            <Route path="/syndicates" element={<Syndicates />} />
            <Route path="/group/:slug" element={<GroupTicketDetail />} />
            <Route path="/results" element={<Results />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Admin />} />
              <Route path="draws" element={<DrawsManager />} />
              <Route path="syndicates" element={<SyndicatesManager />} />
              <Route path="syndicate-picks" element={<SyndicatePicksManager />} />
              <Route path="withdrawals" element={<WithdrawalsManager />} />
              <Route path="withdrawal-configs" element={<WithdrawalConfigsManager />} />
              <Route path="fx" element={<FxPairsManager />} />
              <Route path="lotteries" element={<LotteryBrandingManager />} />
              <Route path="contact" element={<ContactSubmissions />} />
              <Route path="kyc" element={<KycManager />} />
              <Route path="reports" element={<SocialReports />} />
              <Route path="secrets" element={<SecretsAudit />} />
              <Route path="github" element={<GitHubSyncStatus />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/kyc" element={<ProtectedRoute><Kyc /></ProtectedRoute>} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/responsible-play" element={<ResponsiblePlay />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/wallet/add-funds" element={<ProtectedRoute><AddFunds /></ProtectedRoute>} />
            <Route path="/wallet/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
            <Route path="/wallet/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
          </WalletProvider>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
