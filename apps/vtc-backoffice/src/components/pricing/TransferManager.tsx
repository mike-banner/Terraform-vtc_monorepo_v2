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
      <div className='flex justify-center p-20 text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs'>
        Chargement des forfaits...
      </div>
    );

  return (
    <div className='space-y-8'>
      {/* Routes Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {routes.map((r) => (
          <div
            key={r.id}
            className='bg-card/50 p-6 rounded-[var(--radius)] border border-border hover:border-primary/50 hover:shadow-md transition-all group relative overflow-hidden'>

            <div className='flex justify-between items-center mb-4'>
              <div className='flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20'>
                {r.vehicle_category}
              </div>
              {r.is_bidirectional && (
                <div className='text-muted-foreground' title='Aller-Retour'>
                  <ArrowRightLeft className='w-3.5 h-3.5' />
                </div>
              )}
            </div>

            <div className='flex items-center gap-2 mb-6 min-w-0'>
              <div className='flex items-center gap-2 min-w-0 flex-1 transition-all group-hover:gap-3'>
                <span className='text-sm sm:text-base font-heading font-black text-foreground uppercase tracking-wide truncate'>
                  {r.pickup_zone?.name}
                </span>
                <ArrowRightLeft className='w-3 h-3 text-muted-foreground flex-shrink-0' />
                <span className='text-sm sm:text-base font-heading font-black text-foreground uppercase tracking-wide truncate'>
                  {r.dropoff_zone?.name}
                </span>
              </div>
            </div>

            <div className='flex items-center justify-between pt-4 border-t border-border/50'>
              <div className='flex items-baseline gap-1'>
                <p className='text-xl sm:text-2xl font-bold text-foreground tabular-nums tracking-tight'>
                  {r.price}
                </p>
                <span className='text-xs font-bold text-muted-foreground'>€</span>
              </div>
              <div className='flex gap-1.5'>
                <button
                  onClick={() => {
                    setEditingRoute(r);
                    setShowRouteModal(true);
                  }}
                  className='p-2 text-muted-foreground hover:text-primary transition-colors bg-background rounded-md border border-border hover:bg-primary/10'>
                  <Edit className='w-4 h-4' />
                </button>
                <button
                  onClick={() => handleDeleteRoute(r.id)}
                  className='p-2 text-muted-foreground hover:text-red-500 transition-colors bg-background rounded-md border border-border hover:bg-red-500/10 hover:border-red-500/20'>
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            </div>
          </div>
        ))}

        {routes.length === 0 && (
          <div className='col-span-full py-20 text-center bg-card/30 rounded-[var(--radius)] border border-border'>
            <div className='w-12 h-12 bg-background rounded-xl flex items-center justify-center text-muted-foreground mx-auto mb-4'>
              <MapPin className='w-6 h-6' />
            </div>
            <p className='text-muted-foreground text-xs font-bold uppercase tracking-widest'>
              Aucun forfait configuré
            </p>
          </div>
        )}
      </div>

      {/* ZONE MODAL */}
      {showZoneModal && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm'>
          <div className='relative bg-card max-w-md w-full rounded-[calc(var(--radius)+8px)] border border-border shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200'>
            <button
              onClick={() => setShowZoneModal(false)}
              className='absolute top-6 right-6 text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg transition-colors'>
              <X className='w-5 h-5' />
            </button>
            <h3 className='text-xl font-heading font-black uppercase text-foreground mb-1'>Zones</h3>
            <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-6'>
              Points de départ/arrivée (ex: Paris, CDG)
            </p>

            <div className='max-h-60 overflow-y-auto pr-2 mb-6 space-y-2'>
              {zones.map((z) => (
                <div
                  key={z.id}
                  className='flex justify-between items-center px-4 py-3 bg-background border border-border rounded-[var(--radius)] uppercase font-semibold text-xs text-foreground'>
                  {z.name}
                </div>
              ))}
              {zones.length === 0 && (
                <p className='text-xs text-muted-foreground text-center py-4'>Aucune zone existante.</p>
              )}
            </div>

            <form onSubmit={handleCreateZone} className='space-y-4'>
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder='Nom de la zone (ex: Orly)'
                className='w-full bg-background border border-border rounded-[var(--radius)] px-4 py-3 text-foreground font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all uppercase'
              />
              <button
                disabled={submitting}
                className='w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[var(--radius)] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20'>
                {submitting ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
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
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm'>
          <div className='relative bg-card max-w-lg w-full rounded-[calc(var(--radius)+8px)] border border-border shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200'>
            <button
              onClick={() => setShowRouteModal(false)}
              className='absolute top-6 right-6 text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg transition-colors'>
              <X className='w-5 h-5' />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                </div>
                <div>
                    <h3 className='text-lg font-heading font-black uppercase text-foreground leading-none tracking-tight'>
                    {editingRoute ? 'Modifier' : 'Nouveau'} Forfait
                    </h3>
                    <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1'>
                    Prix point à point
                    </p>
                </div>
            </div>

            <form onSubmit={handleRouteSubmit} className='space-y-5'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                    Départ
                  </label>
                  <div className='relative group'>
                    <select
                      name='pickup'
                      defaultValue={editingRoute?.pickup_zone_id}
                      required
                      className='w-full bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 text-foreground font-semibold text-sm appearance-none outline-none focus:ring-1 focus:ring-primary focus:border-primary uppercase cursor-pointer transition-all'>
                      <option value='' className='bg-card text-muted-foreground'>
                        SÉLECTIONNER
                      </option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id} className='bg-card text-foreground'>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                    Arrivée
                  </label>
                  <div className='relative group'>
                    <select
                      name='dropoff'
                      defaultValue={editingRoute?.dropoff_zone_id}
                      required
                      className='w-full bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 text-foreground font-semibold text-sm appearance-none outline-none focus:ring-1 focus:ring-primary focus:border-primary uppercase cursor-pointer transition-all'>
                      <option value='' className='bg-card text-muted-foreground'>
                        SÉLECTIONNER
                      </option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id} className='bg-card text-foreground'>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                    Véhicule
                  </label>
                  <div className='relative group'>
                    <select
                      name='category'
                      defaultValue={editingRoute?.vehicle_category}
                      required
                      className='w-full bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 text-foreground font-semibold text-sm appearance-none outline-none focus:ring-1 focus:ring-primary focus:border-primary uppercase cursor-pointer transition-all'>
                      {VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c} className='bg-card text-foreground'>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-semibold uppercase text-muted-foreground tracking-wider ml-1'>
                    Prix Fixe (€)
                  </label>
                  <input
                    name='price'
                    type='number'
                    step='0.01'
                    defaultValue={editingRoute?.price}
                    required
                    placeholder='0.00'
                    className='w-full bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 text-foreground font-semibold tabular-nums text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all'
                  />
                </div>
              </div>

              <div className='flex items-center gap-3 py-3 px-4 bg-muted/30 border border-border rounded-[var(--radius)]'>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    name='bidirectional'
                    id='bidirectional'
                    className='sr-only peer'
                    defaultChecked={editingRoute ? editingRoute.is_bidirectional : true}
                  />
                  <div className="w-10 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
                <span className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>
                  Appliquer dans les deux sens (A/R)
                </span>
              </div>

              <button
                disabled={submitting}
                className='w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[var(--radius)] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20 active:scale-95 mt-4'>
                {submitting ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <>
                    <Plus className='w-4 h-4' /> {editingRoute ? 'Mettre à jour' : 'Enregistrer'} le
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
