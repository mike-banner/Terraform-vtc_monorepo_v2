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

  // States pour les Confirmations
  const [confirmInit, setConfirmInit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  const handleEdit = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedDriver(null);
    setShowModal(true);
  };

  useEffect(() => {
    fetchDrivers();
  }, [tenantId]);

  useEffect(() => {
    const openModal = () => handleCreate();
    window.addEventListener('drivers:open-modal', openModal);
    return () => window.removeEventListener('drivers:open-modal', openModal);
  }, []);

  const primaryDriver = drivers.find((d) => d.user_id === userId);
  const collaborators = drivers.filter((d) => d.user_id !== userId);

  return (
    <div className='flex flex-col h-full'>
      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='glass h-56 rounded-[2rem] border border-white/5 animate-pulse bg-white/5'
            />
          ))}
        </div>
      ) : (
        <div className='space-y-12 overflow-y-auto pr-2 custom-scrollbar pb-20'>
          {/* SECTION 1: TITULAIRE DU COMPTE */}
          {!hidePrimary && (
            <div>
              <div className='mb-6'>
                <p className='text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-3'>
                  <span className='w-8 h-[1px] bg-indigo-500/30'></span>
                  Titulaire du Compte
                </p>
              </div>

              {primaryDriver ? (
                <div className='max-w-2xl'>
                  <DriverCard
                    driver={primaryDriver}
                    onEdit={handleEdit}
                    onDelete={setConfirmDelete}
                    isPrimary
                  />
                </div>
              ) : (
                <div className='max-w-2xl glass p-8 rounded-[2.5rem] border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all'>
                  <div className='w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-700 mb-4 group-hover:text-indigo-400 transition-colors'>
                    <UserCheck className='w-8 h-8' />
                  </div>
                  <h4 className='text-sm font-black text-white uppercase tracking-widest mb-2'>
                    Aucun titulaire assigné
                  </h4>
                  <p className='text-[10px] text-slate-500 uppercase tracking-widest mb-6 max-w-xs'>
                    Enregistrez-vous comme premier chauffeur pour activer votre profil complet.
                  </p>
                  <button
                    onClick={() => setConfirmInit(true)}
                    className='px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-50 transition-all active:scale-95'>
                    {initLoading ? 'Initialisation...' : "M'ajouter comme chauffeur"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: COLLABORATEURS */}
          <div>
            <div className='mb-6 flex items-center justify-between'>
              <p className='text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3'>
                <span className='w-8 h-[1px] bg-slate-800'></span>
                Équipe & Collaborateurs
              </p>
              {isOwner && (
                <button
                  onClick={handleCreate}
                  className='flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500/20 transition-all active:scale-95'>
                  <UserPlus className='w-3.5 h-3.5' />
                  Ajouter
                </button>
              )}
            </div>

            {collaborators.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                {collaborators.map((d) => (
                  <DriverCard
                    key={d.id}
                    driver={d}
                    onEdit={handleEdit}
                    onDelete={setConfirmDelete}
                  />
                ))}
              </div>
            ) : (
              <div className='glass p-12 rounded-[2.5rem] border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center'>
                <p className='text-[10px] text-slate-600 font-black uppercase tracking-widest'>
                  Aucun collaborateur enregistré
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal d'édition / création */}
      <DriverModal
        tenantId={tenantId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchDrivers}
        driver={selectedDriver}
      />

      {/* Confirmation Initialisation */}
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

      {/* Confirmation Suppression */}
      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title='Supprimer Chauffeur'
        message={`Es-tu sûr de vouloir supprimer ${confirmDelete?.name} ? Cette action est irréversible.`}
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
    <div
      className={`glass p-8 rounded-[2.5rem] border transition-all group relative overflow-hidden ${
        isPrimary
          ? 'border-indigo-500/30 bg-indigo-500/[0.03] shadow-2xl shadow-indigo-500/10'
          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
      }`}>
      <div
        className={`absolute -bottom-12 -right-12 w-32 h-32 blur-3xl rounded-full transition-all ${
          isPrimary ? 'bg-indigo-500/10' : 'bg-white/5 group-hover:bg-indigo-500/5'
        }`}
      />

      <div className='flex justify-between items-start mb-6 relative z-10'>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 ${
            isPrimary
              ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
              : 'bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-indigo-600'
          }`}>
          <Users className='w-8 h-8' />
        </div>
        <div className='flex items-center gap-1'>
          {isPrimary && (
            <span className='mr-2 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/5'>
              CHAUFFEUR N°1
            </span>
          )}
          <button
            onClick={() => onEdit(driver)}
            className='p-2 text-slate-600 hover:text-white transition-colors'>
            <Edit2 className='w-4 h-4' />
          </button>
          {!isPrimary && (
            <button
              onClick={() =>
                onDelete({
                  id: driver.id,
                  name: `${driver.first_name} ${driver.last_name}`,
                })
              }
              className='p-2 text-slate-600 hover:text-red-500 transition-colors'>
              <Trash2 className='w-4 h-4' />
            </button>
          )}
        </div>
      </div>

      <div className='mb-6 relative z-10'>
        <h3 className='text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1'>
          {driver.first_name}
        </h3>
        <h3
          className={`text-2xl font-black uppercase tracking-tighter leading-none ${isPrimary ? 'text-indigo-400/80' : 'text-white/50'}`}>
          {driver.last_name}
        </h3>
      </div>

      <div className='space-y-3 pt-6 border-t border-white/5 relative z-10'>
        <div className='flex items-center gap-3'>
          <Phone className='w-3 h-3 text-indigo-500' />
          <p className='text-[11px] font-bold text-slate-300 uppercase tracking-widest'>
            {driver.phone}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <CreditCard className='w-3 h-3 text-slate-500' />
          <p className='text-[10px] font-medium text-slate-500 uppercase tracking-widest'>
            Carte : {driver.license_number}
          </p>
        </div>
      </div>
    </div>
  );
};
