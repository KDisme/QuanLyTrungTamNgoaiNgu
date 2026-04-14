import { Navigate, Outlet } from "react-router-dom";
import { isTokenUsable } from "../utils/token";

const ProtectedRoute = () => {
  const token = localStorage.getItem("token");

  if (!isTokenUsable(token)) {
    localStorage.removeItem("token");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;