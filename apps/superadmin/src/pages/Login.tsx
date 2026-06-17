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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-slate-900 p-3 rounded-full">
            <Shield className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">Superadmin VTC</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Administrateur</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
              placeholder="super@admin.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-slate-900 text-white font-medium py-2.5 px-4 rounded-md hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
          >
            Connexion Sécurisée
          </button>
        </form>
      </div>
    </div>
  );
};
