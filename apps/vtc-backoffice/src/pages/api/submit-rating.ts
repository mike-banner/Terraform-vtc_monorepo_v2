// src/pages/api/submit-rating.ts
import type { APIRoute } from 'astro';
import { createAdminClient } from '../../lib/supabase/server';

export const POST: APIRoute = async ({ request }) => {
  const supabaseAdmin = createAdminClient();
  try {
    const body = await request.json();
    const { bookingId } = body;
    const rating = parseInt(body.rating, 10);
    const comment = typeof body.comment === 'string'
      ? body.comment.trim().slice(0, 500)
      : null;

    // Validation stricte
    if (!bookingId || !rating) {
      return new Response(JSON.stringify({ error: 'Données manquantes' }), { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Note invalide (1-5)' }), { status: 400 });
    }

    // 1️⃣ Vérifier existence, statut completed, et non encore noté
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('rating, mission_status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: 'Réservation non trouvée' }), { status: 404 });
    }
    if (booking.mission_status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Course non terminée' }), { status: 400 });
    }
    if (booking.rating !== null) {
      return new Response(JSON.stringify({ error: 'Déjà noté' }), { status: 400 });
    }

    // 2️⃣ Mettre à jour
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        rating,
        rating_comment: comment,
        rating_created_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
