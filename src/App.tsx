import { useState } from 'react';
import { GameProvider, SESSION_KEY, useGame } from '@/game/store';
import { LoginScreen } from '@/pages/LoginScreen';
import { Layout } from '@/components/Layout';
import { SquadPage } from '@/pages/SquadPage';
import { MatchPage } from '@/pages/MatchPage';
import { ClubPage } from '@/pages/ClubPage';
import { AccountPage } from '@/pages/AccountPage';

function Pages() {
  const { page } = useGame();
  return (
    <Layout>
      {page === 'squad' && <SquadPage />}
      {page === 'match' && <MatchPage />}
      {page === 'club' && <ClubPage />}
      {page === 'account' && <AccountPage />}
    </Layout>
  );
}

export default function App() {
  const [account, setAccount] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  if (!account) {
    return <LoginScreen onLogin={(n) => { localStorage.setItem(SESSION_KEY, n); setAccount(n); }} />;
  }
  return (
    <GameProvider key={account} account={account} onLogout={() => { localStorage.removeItem(SESSION_KEY); setAccount(null); }}>
      <Pages />
    </GameProvider>
  );
}
