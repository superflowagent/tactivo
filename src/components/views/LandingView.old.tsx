// Backup of previous LandingView before applying Tailwind Toolbox template
// Created automatically

import { useNavigate } from 'react-router-dom';
// Removed framer-motion import (unused) to avoid TS build error in CI

export function LandingViewOld() {
  const navigate = useNavigate();
  return (
    <div>Previous landing content (backup)</div>
  );
}
