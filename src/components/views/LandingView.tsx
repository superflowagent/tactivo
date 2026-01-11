import { useEffect } from 'react';

export function LandingView() {
  useEffect(() => {
    // Full page redirect to the static Landy build
    window.location.href = '/landing/dist/';
  }, []);

  return <div>Redirigiendo a la landing...</div>;
}
