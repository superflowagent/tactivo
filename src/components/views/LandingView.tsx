export function LandingView() {
  // Show the app logo as a simple placeholder for the landing page to avoid iframe/CORS issues
  return (
    <div className="min-h-screen h-screen w-full bg-white flex items-center justify-center">
      <a href="/" aria-label="Tactivo home">
        <img src="/favicon.svg" alt="Tactivo" style={{ width: 160, height: 160 }} />
      </a>
    </div>
  );
}
