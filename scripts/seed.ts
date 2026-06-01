// ============================================================
// COSTAMALLAS ERP — Seed inicial de base de datos
// Ejecutar con: npm run seed
// ============================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de Costamallas ERP…");

  // ── Usuario Admin ─────────────────────────
  const hashedPwd = await bcrypt.hash("CM2026admin#", 12);

  await prisma.usuario.upsert({
    where: { email: "admin@costamallas.com" },
    update: {},
    create: {
      nombre: "Administrador",
      email: "admin@costamallas.com",
      password: hashedPwd,
      rol: "ADMIN",
      activo: true,
    },
  });
  console.log("✅ Usuario admin creado (admin@costamallas.com / CM2026admin#)");

  // ── Catálogos ─────────────────────────────
  const categorias = [
    { valor: "mallas-metalicas",      label: "Mallas Metálicas" },
    { valor: "mallas-para-balcones",  label: "Mallas para Balcones" },
    { valor: "mallas-nylon",          label: "Mallas Nylon" },
    { valor: "mallas-plasticas",      label: "Mallas Plásticas" },
    { valor: "seguridad-perimetral",  label: "Seguridad Perimetral" },
    { valor: "mallas-construccion",   label: "Mallas para Construcción" },
  ];

  for (const cat of categorias) {
    await prisma.catalogo.upsert({
      where: { tipo_valor: { tipo: "CATEGORIA", valor: cat.valor } },
      update: {},
      create: { tipo: "CATEGORIA", valor: cat.valor, label: cat.label },
    });
  }

  const unidades = [
    { valor: "m2",    label: "m²" },
    { valor: "ml",    label: "ml" },
    { valor: "und",   label: "Unidad" },
    { valor: "rollo", label: "Rollo" },
    { valor: "panel", label: "Panel" },
    { valor: "kit",   label: "Kit" },
  ];

  for (const u of unidades) {
    await prisma.catalogo.upsert({
      where: { tipo_valor: { tipo: "UNIDAD_VENTA", valor: u.valor } },
      update: {},
      create: { tipo: "UNIDAD_VENTA", valor: u.valor, label: u.label },
    });
  }

  console.log("✅ Catálogos creados");

  // ── Configuración base ────────────────────
  const configs = [
    { clave: "wc_store_url",   valor: "https://costamallas.com", encrypted: false,
      descripcion: "URL de la tienda WooCommerce" },
    { clave: "app_nombre",     valor: "Costamallas ERP",          encrypted: false,
      descripcion: "Nombre del portal" },
    { clave: "stock_critico",  valor: "5",                        encrypted: false,
      descripcion: "Umbral de stock crítico" },
    { clave: "stock_bajo",     valor: "15",                       encrypted: false,
      descripcion: "Umbral de stock bajo" },
  ];

  for (const cfg of configs) {
    await prisma.configuracion.upsert({
      where: { clave: cfg.clave },
      update: {},
      create: cfg,
    });
  }

  console.log("✅ Configuración base creada");

  // ── Productos demo ────────────────────────
  const productosDemo = [
    {
      sku: "CM-0001",
      nombre: "Malla Ciclon 2\" Galvanizada",
      slug: "malla-ciclon-2-galvanizada",
      publicado: true,
      precioNormal: 89000,
      stock: 120,
      stockMinimo: 20,
      categorias: ["mallas-metalicas"],
      acfMarcaFabricante: "Ternium",
      acfUnidadVenta: "m2",
      intEstado: "PUBLICADO" as const,
      intListoExportar: true,
    },
    {
      sku: "CM-0002",
      nombre: "Malla Nylon Verde 50mm",
      slug: "malla-nylon-verde-50mm",
      publicado: true,
      precioNormal: 34500,
      stock: 8,
      stockMinimo: 15,
      categorias: ["mallas-nylon"],
      acfMarcaFabricante: "Versaline",
      acfUnidadVenta: "m2",
      intEstado: "PUBLICADO" as const,
      intListoExportar: false,
    },
    {
      sku: "CM-0003",
      nombre: "Panel Seguridad 3D 50x200 Gris",
      slug: "panel-seguridad-3d-50x200-gris",
      publicado: false,
      precioNormal: 380000,
      stock: 0,
      stockMinimo: 5,
      categorias: ["seguridad-perimetral"],
      acfMarcaFabricante: "Pilofix",
      acfUnidadVenta: "panel",
      intEstado: "LISTO" as const,
      intListoExportar: true,
    },
  ];

  for (const p of productosDemo) {
    await prisma.producto.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        ...p,
        visibilidad: "visible",
        permiteBackorders: "no",
        permiteResenas: true,
        enStock: p.stock > 0,
      },
    });
  }

  console.log("✅ Productos demo creados");
  console.log("\n🎉 Seed completado. Accede al portal con:");
  console.log("   Email: admin@costamallas.com");
  console.log("   Contraseña: CM2026admin#");
}

main()
  .catch((e) => { console.error("❌ Error en seed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
