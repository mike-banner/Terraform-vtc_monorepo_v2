import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 border border-border">
        <div className="flex justify-center mb-6">
          <div className="bg-primary p-3 rounded-full">
            <Shield className="h-8 w-8 text-on-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-primary mb-8">Superadmin VTC</h2>
        
        {error && (
          <div className="bg-danger-subtle text-danger p-3 rounded-md text-sm mb-6 border border-danger-soft">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-body mb-2">Email Administrateur</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-border-strong rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              placeholder="super@admin.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-body mb-2">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-border-strong rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-on-primary font-medium py-2.5 px-4 rounded-md hover:bg-primary-hover transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Connexion Sécurisée
          </button>
        </form>
      </div>
    </div>
  );
};
