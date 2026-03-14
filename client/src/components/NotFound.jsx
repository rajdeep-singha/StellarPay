import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-pink-400 to-purple-400 text-black font-semibold hover:opacity-90 transition-all"
      >
        Go Home
      </Link>
    </div>
  );
}

export default NotFound;
