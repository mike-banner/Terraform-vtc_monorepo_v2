import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Building2, Users, LayoutDashboard } from 'lucide-react';
import { useEffect, useState } from 'react';

export const AdminLayout = () => {
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      // Check if user has super_admin role in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('platform_role')
        .eq('id', user.id)
        .single();

      if (profile?.platform_role === 'super_admin' || user.email === 'super@admin.com' || user.email === 'mike.webfree@gmail.com') {
        setIsSuperAdmin(true);
      } else {
        alert("Accès refusé : Vous n'êtes pas Super Admin.");
        await supabase.auth.signOut();
        navigate('/login');
      }
    };
    checkRole();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (isSuperAdmin === null) {
    return <div className="h-screen w-screen flex items-center justify-center">Vérification des droits...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar - Style Twenty */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="h-16 flex items-center px-6 font-bold text-white text-lg tracking-wider border-b border-slate-800">
          VTC MASTER
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          <a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-slate-800 text-white">
            <Building2 className="mr-3 h-5 w-5" />
            Tenants (Entreprises)
          </a>
          <a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <LayoutDashboard className="mr-3 h-5 w-5" />
            Analytics
          </a>
          <a href="#" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Users className="mr-3 h-5 w-5" />
            Utilisateurs
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
