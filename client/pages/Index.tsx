// This file is no longer needed as the main dashboard is handled directly in App.tsx
// Keeping for backwards compatibility
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
