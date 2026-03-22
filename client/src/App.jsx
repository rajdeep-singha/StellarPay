import { Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './components/HomePage';
import EmployerDashboard from './components/EmployerDashboard';
import NotFound from './components/NotFound';
import { WalletProvider } from './context/WalletContext';

function App() {
  const location = useLocation();

  const isOnEmployer = location.pathname.startsWith('/employer');
  const targetPath = isOnEmployer ? '/' : '/employer';
  const label = isOnEmployer ? 'Home' : 'Employer Dashboard';
import TransactionHistory from './components/TransactionHistory';
import { useWallet } from './hooks/useWallet';

function App() {
  const [view, setView] = useState('home');
  const { transactions } = useWallet();

  return (
    <WalletProvider>
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
        }}
      >
        <Link
          to={targetPath}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(to right, #f472b6, #a78bfa)',
            color: 'black',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {label}
        </Link>
      </div>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/employer" element={<EmployerDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </WalletProvider>
      {view === 'employer' ? <EmployerDashboard /> : <HomePage />}
      <TransactionHistory transactions={transactions} />
    </>
  );
}

export default App;