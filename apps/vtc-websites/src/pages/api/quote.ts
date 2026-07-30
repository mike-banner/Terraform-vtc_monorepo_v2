import type { APIRoute } from "astro";
import { submitQuoteRequest } from "../../core/booking";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { tenant } = locals;

    if (!tenant?.id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
      });
    }

    const result = await submitQuoteRequest({
      ...body,
      tenantId: tenant.id,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
      });
    }

    return new Response(
      JSON.stringify({ success: true, data: result.booking }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
};
