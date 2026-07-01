import { deleteDriver, getDrivers, initializePrimaryDriver } from '@/services/drivers';
import { CreditCard, Edit2, Phone, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { DriverModal } from './DriverModal';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  license_number: string;
  user_id: string | null;
  created_at: string;
}

interface DriverListProps {
  tenantId: string;
  userId: string;
  hidePrimary?: boolean;
  isOwner?: boolean;
}

export const DriverList: React.FC<DriverListProps> = ({ tenantId, userId, hidePrimary, isOwner }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [confirmInit, setConfirmInit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const data = await getDrivers(tenantId);
      setDrivers((data as Driver[]) || []);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      setInitLoading(true);
      const res = await initializePrimaryDriver(tenantId, userId);
      if (res.success) {
        fetchDrivers();
        setConfirmInit(false);
      } else {
        alert(res.error || res.message || "Erreur lors de l'initialisation");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      setLoading(true);
      await deleteDriver(confirmDelete.id);
      fetchDrivers();
      setConfirmDelete(null);
    } catch (err) {
      alert('Erreur lors de la suppression');
      setLoading(false);
    }
  };

  const handleEdit = (driver: Driver) => { setSelectedDriver(driver); setShowModal(true); };
  const handleCreate = () => { setSelectedDriver(null); setShowModal(true); };

  useEffect(() => { fetchDrivers(); }, [tenantId]);
  useEffect(() => {
    const openModal = () => handleCreate();
    window.addEventListener('drivers:open-modal', openModal);
    return () => window.removeEventListener('drivers:open-modal', openModal);
  }, []);

  const primaryDriver = drivers.find((d) => d.user_id === userId);
  const collaborators = drivers.filter((d) => d.user_id !== userId);

  return (
    <div className='flex flex-col gap-8'>
      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {[1, 2, 3].map((i) => (
            <div key={i} className='bg-card border border-border rounded-2xl h-28 animate-pulse' />
          ))}
        </div>
      ) : (
        <>
          {/* SECTION: TITULAIRE */}
          {!hidePrimary && (
            <div>
              <p className='text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4'>
                Titulaire du Compte
              </p>
              {primaryDriver ? (
                <div className='max-w-2xl'>
                  <DriverCard driver={primaryDriver} onEdit={handleEdit} onDelete={setConfirmDelete} isPrimary />
                </div>
              ) : (
                <div className='max-w-2xl bg-card border border-dashed border-border rounded-2xl p-8 flex flex-col items-center text-center gap-4'>
                  <UserCheck className='w-8 h-8 text-muted-foreground' />
                  <div>
                    <p className='text-sm font-semibold text-foreground mb-1'>Aucun titulaire assigné</p>
                    <p className='text-xs text-muted-foreground'>Enregistrez-vous comme premier chauffeur pour activer votre profil.</p>
                  </div>
                  <button
                    onClick={() => setConfirmInit(true)}
                    className='px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95'>
                    {initLoading ? 'Initialisation...' : "M'ajouter comme chauffeur"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: COLLABORATEURS */}
          <div>
            <div className='flex items-center justify-between mb-4'>
              <p className='text-xs font-bold text-muted-foreground uppercase tracking-widest'>
                Équipe & Collaborateurs
              </p>
              {isOwner && (
                <button
                  onClick={handleCreate}
                  className='flex items-center gap-1.5 px-3 py-2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary/20 transition-all active:scale-95'>
                  <UserPlus className='w-3.5 h-3.5' />
                  Ajouter
                </button>
              )}
            </div>
            {collaborators.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {collaborators.map((d) => (
                  <DriverCard key={d.id} driver={d} onEdit={handleEdit} onDelete={setConfirmDelete} />
                ))}
              </div>
            ) : (
              <div className='bg-card border border-border rounded-2xl p-8 text-center'>
                <p className='text-xs text-muted-foreground'>Aucun collaborateur enregistré</p>
              </div>
            )}
          </div>
        </>
      )}

      <DriverModal
        tenantId={tenantId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchDrivers}
        driver={selectedDriver}
      />

      <ConfirmationModal
        isOpen={confirmInit}
        onClose={() => setConfirmInit(false)}
        onConfirm={handleInitialize}
        loading={initLoading}
        title='Initialisation Chauffeur'
        message="Voulez-vous vous enregistrer automatiquement comme premier chauffeur en utilisant vos informations d'inscription ?"
        confirmLabel="S'enregistrer"
        confirmVariant='primary'
      />

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title='Supprimer Chauffeur'
        message={`Supprimer ${confirmDelete?.name} ? Cette action est irréversible.`}
        confirmLabel='Supprimer'
        confirmVariant='danger'
      />
    </div>
  );
};

// --- SUB-COMPONENT: DRIVER CARD ---
interface DriverCardProps {
  driver: Driver;
  onEdit: (driver: Driver) => void;
  onDelete: (del: { id: string; name: string }) => void;
  isPrimary?: boolean;
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, onEdit, onDelete, isPrimary }) => {
  return (
    <div className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 transition-all ${
      isPrimary ? 'border-primary/20' : 'border-border'
    }`}>
      <div className='flex items-center gap-3'>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPrimary ? 'bg-primary/10 text-primary' : 'bg-white/5 text-muted-foreground'
        }`}>
          <Users className='w-5 h-5' />
        </div>
        <div className='flex-1 min-w-0'>
          {isPrimary && (
            <p className='text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5'>Chauffeur N°1</p>
          )}
          <h3 className='text-base font-black text-foreground uppercase tracking-tighter leading-none truncate'>
            {driver.first_name} {driver.last_name}
          </h3>
        </div>
        <div className='flex items-center gap-0.5 flex-shrink-0'>
          <button
            onClick={() => onEdit(driver)}
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors'>
            <Edit2 className='w-4 h-4' />
          </button>
          {!isPrimary && (
            <button
              onClick={() => onDelete({ id: driver.id, name: `${driver.first_name} ${driver.last_name}` })}
              className='p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors'>
              <Trash2 className='w-4 h-4' />
            </button>
          )}
        </div>
      </div>

      <div className='border-t border-border pt-3 flex flex-col gap-3'>
        <div className='flex items-center gap-2'>
          <Phone className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
          <span className='text-sm font-medium text-foreground'>{driver.phone || '—'}</span>
        </div>
        <div className='flex items-center gap-2'>
          <CreditCard className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
          <span className='text-xs font-mono font-medium text-muted-foreground tracking-widest'>{driver.license_number || '—'}</span>
        </div>
      </div>
    </div>
  );
};
