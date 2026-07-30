// src/pages/api/missions/terrain-transition.ts
import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';

type TerrainAction = 'en_route' | 'on_board' | 'completed';

const TERRAIN_TAGS: Record<TerrainAction, string> = {
  en_route: 'en_route_at',
  on_board: 'on_board_at',
  completed: 'completed_at',
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { profile } = locals;
  if (!profile) return new Response('Unauthorized', { status: 401 });

  const supabase = createAdminClient(locals);

  try {
    const { booking_id, action, corrected_at } = await request.json();

    if (!booking_id || !action || !(action in TERRAIN_TAGS)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    if (!profile.tenant_id) {
      return new Response('Forbidden', { status: 403 });
    }

    let resolvedCorrectedAt: string | null = null;
    if (action === 'completed' && corrected_at) {
      const d = new Date(corrected_at);
      if (!isNaN(d.getTime())) resolvedCorrectedAt = d.toISOString();
    }

    // 1. Fetch booking and verify ownership (tenant)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, pickup_time, mission_note, current_tenant_id')
      .eq('id', booking_id)
      .eq('current_tenant_id', profile.tenant_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
    }

    // 2. Guard H-15 for en_route
    if (action === 'en_route') {
      const pickupTimeMs = new Date(booking.pickup_time).getTime();
      const availableAtMs = pickupTimeMs - 15 * 60 * 1000;
      if (Date.now() < availableAtMs) {
        return new Response(
          JSON.stringify({ error: 'Too early', available_at: new Date(availableAtMs).toISOString() }),
          { status: 400 }
        );
      }
    }

    // 3. Prepare Notes Update
    const nowIso = resolvedCorrectedAt ?? new Date().toISOString();
    const marker = `[terrain] ${TERRAIN_TAGS[action as TerrainAction]}=${nowIso}`;
    const currentNotes = (booking.mission_note ?? '').toString();
    const alreadyMarked = currentNotes.includes(`[terrain] ${TERRAIN_TAGS[action as TerrainAction]}=`);
    const correctionFlag = resolvedCorrectedAt ? '\n[terrain] completed_at_was_corrected=true' : '';
    const nextNotes = alreadyMarked ? currentNotes : `${currentNotes}${currentNotes ? '\n' : ''}${marker}${correctionFlag}`;

    const updatePayload: any = { mission_note: nextNotes };

    if (action === 'en_route') {
      updatePayload.mission_status = 'in_progress';
    } else if (action === 'completed') {
      updatePayload.status = 'completed';
      updatePayload.mission_status = 'completed';
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, mission_note: nextNotes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Terrain transition error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
