import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Building2, ClipboardCheck, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
    isActive ? 'bg-sidebar-hover text-on-primary' : 'hover:bg-sidebar-hover hover:text-on-primary'
  }`;

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

      // Seule source d'autorité : platform_role en base (RLS sur profiles).
      // Ne jamais ajouter d'allowlist d'emails en dur ici : c'est une backdoor.
      if (profile?.platform_role === 'super_admin' || profile?.platform_role === 'platform_staff') {
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Style Twenty */}
      <aside className="w-64 bg-sidebar text-sidebar-text flex flex-col">
        <div className="h-16 flex items-center px-6 font-bold text-on-primary text-lg tracking-wider border-b border-sidebar-hover">
          VTC MASTER
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          <NavLink to="/" end className={navClass}>
            <Building2 className="mr-3 h-5 w-5" />
            Tenants (Entreprises)
          </NavLink>
          <NavLink to="/onboardings" className={navClass}>
            <ClipboardCheck className="mr-3 h-5 w-5" />
            Onboardings
          </NavLink>
          <NavLink to="/analytics" className={navClass}>
            <BarChart3 className="mr-3 h-5 w-5" />
            Analytics
          </NavLink>
        </nav>

        <div className="p-4 border-t border-sidebar-hover">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-sidebar-muted hover:text-on-primary hover:bg-sidebar-hover rounded-md transition-colors"
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
