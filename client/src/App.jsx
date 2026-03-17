import { useState } from 'react';
import HomePage from './components/HomePage';
import EmployerDashboard from './components/EmployerDashboard';
import TransactionHistory from './components/TransactionHistory';
import { useWallet } from './hooks/useWallet';

function App() {
  const [view, setView] = useState('home');
  const { transactions } = useWallet();

  return (
    <>
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
        <button
          onClick={() => setView(view === 'home' ? 'employer' : 'home')}
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
          {view === 'home' ? 'Employer Dashboard' : 'Home'}
        </button>
      </div>
      {view === 'employer' ? <EmployerDashboard /> : <HomePage />}
      <TransactionHistory transactions={transactions} />
    </>
  );
}

export default App;