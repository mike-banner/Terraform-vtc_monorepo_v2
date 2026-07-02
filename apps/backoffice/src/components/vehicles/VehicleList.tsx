// src/components/vehicles/VehicleList.tsx
import { deleteVehicle, getVehicles } from '@/services/vehicles';
import { Edit2, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { VehicleModal } from './VehicleModal';
import { showToast } from '@/scripts/toast';

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
      showToast('Erreur lors de la suppression', 'error');
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
          classes: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        };
      case 'inactive':
        return { label: 'Inactif', classes: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
      default:
        return {
          label: status || 'Inconnu',
          classes: 'bg-muted/50 text-muted-foreground border-border/50',
        };
    }
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Custom Confirmation Modal */}
      {confirmDeleteId && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm bg-background/80 animate-in fade-in duration-200'>
          <div className='bg-card max-w-sm w-full rounded-[calc(var(--radius)+8px)] border border-border p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200'>
            <div className='w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 mb-6'>
              <Trash2 className='w-6 h-6' />
            </div>
            <h3 className='text-xl font-heading font-black text-foreground uppercase tracking-tight mb-2'>
              Supprimer ?
            </h3>
            <p className='text-muted-foreground text-xs font-medium leading-relaxed mb-8'>
              Cette action est irréversible. Toutes les données liées à ce véhicule seront
              définitivement supprimées.
            </p>
            <div className='flex gap-3'>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className='flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors bg-background border border-border rounded-[var(--radius)]'>
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className='flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-500 rounded-[var(--radius)] shadow-sm shadow-rose-600/20 disabled:opacity-50 transition-all'>
                {isDeleting ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='flex justify-between items-end mb-6'>
        <div>
          <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>
            Liste de vos véhicules ({vehicles.length})
          </p>
        </div>
      </div>

      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='bg-card/50 h-48 rounded-[var(--radius)] border border-border/50 animate-pulse'
            />
          ))}
        </div>
      ) : vehicles.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-y-auto pr-2 pb-12'>
          {vehicles.map((v) => {
            const statusStyle = getStatusDisplay(v.status);
            return (
              <div
                key={v.id}
                onClick={() => handleEdit(v)}
                className='bg-card/50 p-5 md:p-6 rounded-[var(--radius)] border border-border hover:border-primary/50 hover:shadow-md transition-all group relative overflow-hidden cursor-pointer flex flex-col'>

                <div className='flex justify-between items-start mb-6'>
                  <div className='text-[10px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20 tabular-nums uppercase tracking-widest'>
                    {v.plate_number}
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${statusStyle.classes}`}>
                    {statusStyle.label}
                  </div>
                </div>

                <div className='mb-6'>
                  <h3 className='text-lg md:text-xl font-heading font-black text-foreground uppercase tracking-tight mb-1'>
                    {v.brand} {v.model}
                  </h3>
                  <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>
                    {v.category} — {v.capacity} Places
                  </p>
                </div>

                <div className='flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/50 pt-4 gap-4 sm:gap-0 mt-auto'>
                  <div className='flex gap-4 shrink-0'>
                    <div>
                      <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5'>
                        Passagers
                      </p>
                      <div className='flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded border border-primary/10 w-fit shrink-0'>
                        <span className='text-[10px] font-black text-primary uppercase tracking-tighter'>
                          {v.capacity}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5'>
                        Bagages
                      </p>
                      <div className='flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded border border-border w-fit shrink-0'>
                        <span className='text-[10px] font-black text-muted-foreground uppercase tracking-tighter'>
                          {v.luggage_capacity || 3}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center justify-end gap-1.5 border-t border-border/50 sm:border-none pt-4 sm:pt-0'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(v);
                      }}
                      className='p-2 text-muted-foreground hover:text-primary transition-colors bg-background sm:bg-transparent border border-border sm:border-transparent rounded-md sm:hover:bg-primary/10'>
                      <Edit2 className='w-4 h-4' />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(v.id);
                      }}
                      className='p-2 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 transition-colors bg-background sm:bg-transparent border border-border sm:border-transparent rounded-md ml-2 sm:ml-0'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className='flex-1 bg-card/30 rounded-[var(--radius)] border border-border flex flex-col items-center justify-center p-12 md:p-20 text-center'>
          <h3 className='text-xl md:text-2xl font-heading font-black text-foreground uppercase tracking-tight mb-2'>
            Aucun véhicule enregistré
          </h3>
          <p className='text-muted-foreground text-sm font-medium mb-8 max-w-sm'>
            Ajoutez votre premier véhicule pour commencer à gérer vos courses.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className='bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-[var(--radius)] text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm shadow-primary/20 active:scale-95'>
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
