
import { Navigate } from "react-router-dom";
import { useSession } from "next-auth/react";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.user?.email !== "developersclearsite@gmail.com") {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;