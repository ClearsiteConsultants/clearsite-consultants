
import { Navigate } from "react-router-dom";
import { useSession } from "next-auth/react";


interface ProtectedRouteProps {
  children: React.ReactNode;
}


const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { data: session, status } = useSession();
  

if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tech">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
