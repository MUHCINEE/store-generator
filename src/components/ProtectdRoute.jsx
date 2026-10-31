import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectdRoute({ authenticated, children }) {
  const location = useLocation();
  return authenticated ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}