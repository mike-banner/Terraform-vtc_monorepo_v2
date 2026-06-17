/// <reference types="astro/client" />

interface Tenant {
  id: string;
  name: string;
  primary_domain: string;
  theme: "luxury" | "minimal" | "executive";
  stripe_account_id?: string;
  platform_fee_rate: number;
  email?: string;
  phone?: string;
  created_at: string;
}

declare namespace App {
  interface Locals {
    tenant: Tenant;
  }
}
