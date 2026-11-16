import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home"
import Feed from "./pages/Feed";
import PostDetails from "./pages/PostDetails";


function App() {
  return (
    <Routes>
      {/* Auth: Login + Register chung 1 page */}
      <Route path="/auth" element={<Auth />} />

      {/* Sau khi login thành công */}
      <Route path="/profile" element={<Profile />} />

      {/* Verify email */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/home" element={<Home />} />
      <Route path="/feed" element={<Feed />} />
      <Route path="/posts/:postId" element={<PostDetails />} />

      {/* Redirect tất cả về /auth */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

export default App;
