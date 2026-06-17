// src/components/vehicles/VehicleList.tsx
import { deleteVehicle, getVehicles } from '@/services/vehicles';
import { Edit2, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { VehicleModal } from './VehicleModal';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate_number: string;
  category: string | null;
  capacity: number | null;
  luggage_capacity?: number | null;
  status?: string | null;
}

interface VehicleListProps {
  tenantId: string;
}

export const VehicleList: React.FC<VehicleListProps> = ({ tenantId }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await getVehicles(tenantId);
      setVehicles(data || []);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await deleteVehicle(id);
      await fetchVehicles();
      setConfirmDeleteId(null);
    } catch (err) {
      alert('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingVehicle(null);
  };

  useEffect(() => {
    fetchVehicles();
  }, [tenantId]);

  useEffect(() => {
    const openModal = () => {
      setEditingVehicle(null);
      setShowModal(true);
    };
    window.addEventListener('vehicles:open-modal', openModal);
    return () => window.removeEventListener('vehicles:open-modal', openModal);
  }, []);

  const getStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'active':
        return {
          label: 'Opérationnel',
          classes: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10',
        };
      case 'inactive':
        return { label: 'Inactif', classes: 'bg-rose-500/10 text-rose-500 border-rose-500/10' };
      default:
        return {
          label: status || 'Inconnu',
          classes: 'bg-slate-500/10 text-slate-500 border-slate-500/10',
        };
    }
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Custom Confirmation Modal */}
      {confirmDeleteId && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 animate-in fade-in duration-200'>
          <div className='glass max-w-sm w-full rounded-[2rem] border border-white/10 p-8 shadow-2xl animate-in zoom-in duration-300'>
            <div className='w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mb-6'>
              <Trash2 className='w-6 h-6' />
            </div>
            <h3 className='text-xl font-black text-white uppercase tracking-tighter mb-2'>
              Supprimer ?
            </h3>
            <p className='text-slate-400 text-xs font-medium leading-relaxed mb-8'>
              Cette action est irréversible. Toutes les données liées à ce véhicule seront
              définitivement supprimées.
            </p>
            <div className='flex gap-3'>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className='flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors bg-white/5 rounded-xl'>
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className='flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-50'>
                {isDeleting ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='flex justify-between items-end mb-6 md:mb-10'>
        <div>
          <p className='text-[10px] md:text-[10px] font-bold uppercase tracking-widest text-slate-500'>
            Liste de vos véhicules ({vehicles.length})
          </p>
        </div>
      </div>

      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='glass h-48 rounded-[2rem] border border-white/5 animate-pulse bg-white/5'
            />
          ))}
        </div>
      ) : vehicles.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-y-auto pr-2 custom-scrollbar pb-12'>
          {vehicles.map((v) => {
            const statusStyle = getStatusDisplay(v.status);
            return (
              <div
                key={v.id}
                onClick={() => handleEdit(v)}
                className='glass p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/30 transition-all group relative overflow-hidden cursor-pointer'>
                <div className='absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-all' />

                <div className='flex justify-between items-start mb-6'>
                  <div className='text-[10px] font-black text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 tabular-nums uppercase tracking-widest'>
                    {v.plate_number}
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle.classes}`}>
                    {statusStyle.label}
                  </div>
                </div>

                <div className='mb-6'>
                  <h3 className='text-lg md:text-xl font-black text-white uppercase tracking-tighter mb-1'>
                    {v.brand} {v.model}
                  </h3>
                  <p className='text-[10px] font-bold text-slate-500 uppercase tracking-widest'>
                    {v.category} — {v.capacity} Places
                  </p>
                </div>

                <div className='flex flex-col sm:flex-row sm:items-center justify-between border-t border-white/5 pt-6 gap-4 sm:gap-0 mt-auto'>
                  <div className='flex gap-4 shrink-0'>
                    <div>
                      <p className='text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1'>
                        Passagers
                      </p>
                      <div className='flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10 w-fit shrink-0'>
                        <span className='text-[10px] font-black text-indigo-400 uppercase tracking-tighter'>
                          {v.capacity}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className='text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1'>
                        Bagages
                      </p>
                      <div className='flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/10 w-fit shrink-0'>
                        <span className='text-[10px] font-black text-slate-400 uppercase tracking-tighter'>
                          {v.luggage_capacity || 3}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center justify-end gap-1 border-t border-white/5 sm:border-none pt-4 sm:pt-0'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(v);
                      }}
                      className='p-2 text-slate-500 hover:text-white transition-colors bg-white/5 sm:bg-transparent rounded-lg sm:rounded-xl'>
                      <Edit2 className='w-4 h-4' />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(v.id);
                      }}
                      className='p-2 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 transition-all bg-white/5 sm:bg-transparent rounded-lg sm:rounded-xl ml-2 sm:ml-0'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className='flex-1 glass rounded-[2.5rem] border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center p-20 text-center'>
          <h3 className='text-2xl font-black text-white uppercase tracking-tighter mb-2'>
            Aucun véhicule enregistré
          </h3>
          <p className='text-slate-500 text-sm mb-8 max-w-sm'>
            Ajoutez votre premier véhicule pour commencer à gérer vos courses.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className='bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20'>
            + Ajouter un véhicule
          </button>
        </div>
      )}

      <VehicleModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSuccess={fetchVehicles}
        tenantId={tenantId}
        vehicle={editingVehicle}
      />
    </div>
  );
};
