import { useNavigate } from 'react-router-dom';

export function LandingView() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Tactivo</h1>
            </div>

            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-gray-900">Features</a>
              <a href="#benefits" className="text-gray-700 hover:text-gray-900">Benefits</a>
              <a href="#integrations" className="text-gray-700 hover:text-gray-900">Integrations</a>
              <a href="#pricing" className="text-gray-700 hover:text-gray-900">Pricing</a>
              <a href="#faq" className="text-gray-700 hover:text-gray-900">FAQ</a>
            </nav>

            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="mb-6">
            <span className="inline-flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm">
              Trusted by 1M+ users
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Turn Scattered Data Into<br />Smart Decisions
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            One simple dashboard to track your SaaS growth, MRR,<br />
            churn and user behavior—without the chaos.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            Get Started For Free
          </button>

          <p className="text-gray-500 mt-4">
            💳 No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
