import { cssClass, cx } from './utils/styleClass';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import CreateLeaflet from './pages/CreateLeaflet';
import LeafletView from './pages/LeafletView';
import MyLeaflets from './pages/MyLeaflets';
import PricingPage from './pages/PricingPage';
import PaymentSuccess from './pages/PaymentSuccess';
import WhyPage from './pages/WhyPage';
import FeaturesPage from './pages/FeaturesPage';
import FaqPage from './pages/FaqPage';
import ContactPage from './pages/ContactPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/admin/AdminPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import HelpCenterPage from './pages/HelpCenterPage';
import NotFoundPage from './pages/NotFoundPage';
import ChatBot from './components/ChatBot';
function NoticeBanner() {
    const { notice, setNotice } = useAuth();
    if (!notice)
        return null;
    return (<div className={cx("notice-banner", cssClass({ borderRadius: 0, margin: 0 }))}>
      {notice}{' '}
      <span onClick={() => setNotice('')} className={cssClass({ cursor: 'pointer', opacity: 0.6, marginLeft: 8, fontWeight: 900 })}>×</span>
    </div>);
}
function App() {
    return (<AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>);
}
function AppShell() {
    const location = useLocation();
    const isAdmin = location.pathname.startsWith('/admin');
    return (<>
      {!isAdmin && <Navbar />}
      {!isAdmin && <NoticeBanner />}
      <AuthModal />
      {!isAdmin && <ChatBot />}
      <Routes>
          <Route path="/" element={<HomePage />}/>
          <Route path="/why" element={<WhyPage />}/>
          <Route path="/features" element={<FeaturesPage />}/>
          <Route path="/faq" element={<FaqPage />}/>
          <Route path="/contact" element={<ContactPage />}/>
          <Route path="/pricing" element={<PricingPage />}/>
          <Route path="/payment/success" element={<PaymentSuccess />}/>
          <Route path="/forgot-password" element={<ForgotPasswordPage />}/>
          <Route path="/verify-email" element={<VerifyEmailPage />}/>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />}/>
          <Route path="/create-leaflet" element={<ProtectedRoute>
                <CreateLeaflet />
              </ProtectedRoute>}/>
          <Route path="/app/leaflet/:id" element={<ProtectedRoute>
                <LeafletView />
              </ProtectedRoute>}/>
          <Route path="/my-leaflets" element={<ProtectedRoute>
                <MyLeaflets />
              </ProtectedRoute>}/>
          <Route path="/dashboard" element={<ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>}/>
          <Route path="/settings" element={<ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>}/>
          <Route path="/privacy" element={<PrivacyPage />}/>
          <Route path="/terms" element={<TermsPage />}/>
          <Route path="/help" element={<HelpCenterPage />}/>
          {/* Admin CMS — role check is inside AdminPage itself */}
          <Route path="/admin" element={<AdminPage />}/>
          <Route path="/admin/*" element={<AdminPage />}/>
          <Route path="/404" element={<NotFoundPage />}/>
          <Route path="*" element={<NotFoundPage />}/>
        </Routes>
    </>);
}
export default App;
