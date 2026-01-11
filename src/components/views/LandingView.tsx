export function LandingView() {
  // Render the static landing inside an iframe to avoid location-based redirect loops
  return (
    <div className="min-h-screen h-screen w-full bg-white">
      <iframe
        src="/landing/dist/"
        title="Tactivo Landing"
        style={{ border: 0, height: '100%', width: '100%' }}
        sandbox="allow-scripts allow-popups"
        onLoad={() => console.log('Landing iframe loaded')}
      />
    </div>
  );
}
