import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home"
import Feed from "./pages/Feed";
import PostDetails from "./pages/PostDetails";
import MemberProfile from "./pages/MemberProfile";
import NotificationsLayout from "./Components/NotificationsLayout";


function App() {
  return (
    <Routes>
      {/* Auth: Login + Register chung 1 page */}
      <Route path="/auth" element={<Auth />} />

      {/* Verify email */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/home" element={<Home />} />
      <Route element={<NotificationsLayout />}>
        <Route path="/feed" element={<Feed />} />
        <Route path="/questions" element={<Feed key="questions" questionsOnly />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/posts/:postId" element={<PostDetails />} />
        <Route path="/members/:userId" element={<MemberProfile />} />
      </Route>

      {/* Redirect tất cả về /auth */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

export default App;
