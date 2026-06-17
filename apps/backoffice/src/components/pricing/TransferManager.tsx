// src/components/pricing/TransferManager.tsx
import {
  createFixedRoute,
  createZone,
  deleteFixedRoute,
  getFixedRoutes,
  getZones,
  updateFixedRoute,
} from '@/services/pricing';
import { ArrowRightLeft, Edit, Loader2, MapPin, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const VEHICLE_CATEGORIES = ['berline', 'van', 'suv', 'minibus', 'luxury'];

export const TransferManager: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [zones, setZones] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [z, r] = await Promise.all([getZones(tenantId), getFixedRoutes(tenantId)]);
      setZones(z);
      setRoutes(r);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName) return;
    try {
      setSubmitting(true);
      await createZone(tenantId, newZoneName);
      setNewZoneName('');
      setShowZoneModal(false);
      fetchData();
    } catch (err) {
      alert('Erreur lors de la création de la zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRouteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      setSubmitting(true);

      const payload = {
        tenant_id: tenantId,
        pickup_zone_id: formData.get('pickup') as string,
        dropoff_zone_id: formData.get('dropoff') as string,
        vehicle_category: formData.get('category') as string,
        price: parseFloat(formData.get('price') as string),
        is_bidirectional: formData.get('bidirectional') === 'on',
      };

      if (editingRoute) {
        await updateFixedRoute(editingRoute.id, payload);
      } else {
        await createFixedRoute(payload);
      }

      setShowRouteModal(false);
      setEditingRoute(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors de la sauvegarde du forfait.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (window.confirm('Supprimer ce forfait ?')) {
      await deleteFixedRoute(id);
      fetchData();
    }
  };

  useEffect(() => {
    const openTransferModal = () => {
      setEditingRoute(null);
      setShowRouteModal(true);
    };
    const openZoneModal = () => setShowZoneModal(true);

    window.addEventListener('pricing:open-transfer-modal', openTransferModal);
    window.addEventListener('pricing:open-zone-modal', openZoneModal);

    return () => {
      window.removeEventListener('pricing:open-transfer-modal', openTransferModal);
      window.removeEventListener('pricing:open-zone-modal', openZoneModal);
    };
  }, []);

  if (loading)
    return (
      <div className='flex justify-center p-20 text-slate-500 animate-pulse font-bold tracking-widest uppercase text-xs'>
        Chargement des forfaits...
      </div>
    );

  return (
    <div className='space-y-12'>
      {/* Routes Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {routes.map((r) => (
          <div
            key={r.id}
            className='glass p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group relative overflow-hidden'>
            <div className='absolute -bottom-12 -right-12 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-all' />

            <div className='flex justify-between items-center mb-4'>
              <div className='flex items-center gap-2 text-[10px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20'>
                {r.vehicle_category}
              </div>
              {r.is_bidirectional && (
                <div className='text-slate-500/50' title='Aller-Retour'>
                  <ArrowRightLeft className='w-3 h-3' />
                </div>
              )}
            </div>

            <div className='flex items-center gap-2 mb-6 min-w-0'>
              <div className='flex items-center gap-2 min-w-0 flex-1 transition-all group-hover:gap-3'>
                <span className='text-sm md:text-lg font-black text-white uppercase tracking-tighter truncate'>
                  {r.pickup_zone?.name}
                </span>
                <ArrowRightLeft className='w-3 h-3 text-slate-700 flex-shrink-0' />
                <span className='text-sm md:text-lg font-black text-white uppercase tracking-tighter truncate'>
                  {r.dropoff_zone?.name}
                </span>
              </div>
            </div>

            <div className='flex items-center justify-between pt-5 border-t border-white/5'>
              <div className='flex items-baseline gap-1'>
                <p className='text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter'>
                  {r.price}
                </p>
                <span className='text-sm font-bold text-slate-600'>€</span>
              </div>
              <div className='flex gap-1.5'>
                <button
                  onClick={() => {
                    setEditingRoute(r);
                    setShowRouteModal(true);
                  }}
                  className='p-2.5 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5 hover:bg-white/10'>
                  <Edit className='w-3.5 h-3.5' />
                </button>
                <button
                  onClick={() => handleDeleteRoute(r.id)}
                  className='p-2.5 text-slate-700 hover:text-red-500 transition-colors bg-white/5 rounded-lg border border-white/5 hover:bg-red-500/10 hover:border-red-500/20'>
                  <Trash2 className='w-3.5 h-3.5' />
                </button>
              </div>
            </div>
          </div>
        ))}

        {routes.length === 0 && (
          <div className='col-span-full py-20 text-center glass rounded-[2.5rem] border border-white/5 bg-white/[0.01]'>
            <div className='w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-700 mx-auto mb-6'>
              <MapPin className='w-8 h-8' />
            </div>
            <p className='text-slate-500 text-sm font-medium uppercase tracking-widest'>
              Aucun forfait configuré
            </p>
          </div>
        )}
      </div>

      {/* ZONE MODAL */}
      {showZoneModal && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/80'>
          <div className='relative glass max-w-md w-full rounded-[2.5rem] border border-white/10 shadow-2xl p-8 animate-in zoom-in duration-300'>
            <button
              onClick={() => setShowZoneModal(false)}
              className='absolute top-8 right-8 text-slate-500 hover:text-white'>
              <X className='w-6 h-6' />
            </button>
            <h3 className='text-2xl font-black uppercase text-white mb-2'>Zones</h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-8'>
              Définissez vos points de départ/arrivée (ex: Paris, CDG)
            </p>

            <div className='max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-8 space-y-2'>
              {zones.map((z) => (
                <div
                  key={z.id}
                  className='flex justify-between items-center px-5 py-4 bg-white/5 border border-white/5 rounded-xl uppercase font-black text-xs text-white'>
                  {z.name}
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateZone} className='space-y-4'>
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder='Nom de la zone (ex: Orly)'
                className='w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 transition-all uppercase'
              />
              <button
                disabled={submitting}
                className='w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20'>
                {submitting ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <>
                    <Plus className='w-4 h-4' /> Ajouter la zone
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ROUTE MODAL */}
      {showRouteModal && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/80'>
          <div className='relative glass max-w-lg w-full rounded-[3rem] border border-white/10 shadow-2xl p-10 animate-in zoom-in duration-300'>
            <button
              onClick={() => setShowRouteModal(false)}
              className='absolute top-8 right-8 text-slate-500 hover:text-white'>
              <X className='w-6 h-6' />
            </button>
            <h3 className='text-3xl font-black uppercase text-white mb-1'>
              {editingRoute ? 'Modifier' : 'Nouveau'} Forfait
            </h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-10'>
              Configuration d'un prix point à point
            </p>

            <form onSubmit={handleRouteSubmit} className='space-y-6'>
              <div className='grid grid-cols-2 gap-6'>
                <div className='space-y-2'>
                  <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                    Départ
                  </label>
                  <div className='relative group'>
                    <select
                      name='pickup'
                      defaultValue={editingRoute?.pickup_zone_id}
                      required
                      className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-5 text-white font-bold text-sm appearance-none outline-none focus:border-indigo-500 uppercase cursor-pointer'>
                      <option value='' className='bg-[#050505] text-slate-500'>
                        SÉLECTIONNER
                      </option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id} className='bg-[#050505]'>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <div className='absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors'>
                      <Plus className='w-4 h-4 rotate-45 transform' />
                    </div>
                  </div>
                </div>
                <div className='space-y-2'>
                  <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                    Arrivée
                  </label>
                  <div className='relative group'>
                    <select
                      name='dropoff'
                      defaultValue={editingRoute?.dropoff_zone_id}
                      required
                      className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-5 text-white font-bold text-sm appearance-none outline-none focus:border-indigo-500 uppercase cursor-pointer'>
                      <option value='' className='bg-[#050505] text-slate-500'>
                        SÉLECTIONNER
                      </option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id} className='bg-[#050505]'>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <div className='absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors'>
                      <Plus className='w-4 h-4 rotate-45 transform' />
                    </div>
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-6'>
                <div className='space-y-2'>
                  <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                    Véhicule
                  </label>
                  <div className='relative group'>
                    <select
                      name='category'
                      defaultValue={editingRoute?.vehicle_category}
                      required
                      className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-5 text-white font-bold text-sm appearance-none outline-none focus:border-indigo-500 uppercase cursor-pointer'>
                      {VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c} className='bg-[#050505]'>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className='absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors'>
                      <Plus className='w-4 h-4 rotate-45 transform' />
                    </div>
                  </div>
                </div>
                <div className='space-y-2'>
                  <label className='text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1'>
                    Prix Fixe (€)
                  </label>
                  <input
                    name='price'
                    type='number'
                    step='0.01'
                    defaultValue={editingRoute?.price}
                    required
                    placeholder='0.00'
                    className='w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white font-bold tabular-nums outline-none focus:border-indigo-500'
                  />
                </div>
              </div>

              <div className='flex items-center gap-4 py-4 px-6 bg-white/5 border border-white/5 rounded-2xl'>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    name='bidirectional'
                    id='bidirectional'
                    className='sr-only peer'
                    defaultChecked={editingRoute ? editingRoute.is_bidirectional : true}
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <span className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
                  Appliquer dans les deux sens (A/R)
                </span>
              </div>

              <button
                disabled={submitting}
                className='w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95'>
                {submitting ? (
                  <Loader2 className='w-6 h-6 animate-spin' />
                ) : (
                  <>
                    <Plus className='w-5 h-5' /> {editingRoute ? 'Mettre à jour' : 'Enregistrer'} le
                    Forfait
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
