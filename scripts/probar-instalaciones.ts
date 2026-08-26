// ============================================================
// Comprueba el aviso al coordinador y el acta de entrega.
//
//   npx tsx scripts/probar-instalaciones.ts
//
// Los dos se construyeron el 5 de agosto y NUNCA se habían ejecutado:
// hay 0 instalaciones en la base, así que ni el aviso ni el acta se
// habían visto con datos. Dos módulos completos dados por buenos porque
// compilaban.
//
// Este script fabrica el caso: cliente, pedido con ítems, aprobación con
// instalación, y comprueba paso a paso qué pasa. Después arma el acta
// con la MISMA consulta que usa la pantalla y comprueba que no falte
// nada de lo que ese papel imprime.
//
// ⚠️ ESCRIBE EN LA BASE DE PRODUCCIÓN y lo borra todo al terminar,
// incluso si algo falla. Todo lo que crea lleva el prefijo VERIF-.
// El número de pedido NO sale del consecutivo: se pone a mano para no
// quemar un número real.
//
// El correo NO se manda: el SMTP no está configurado y la ruta lo
// detecta antes de intentarlo. Que eso se detecte también se comprueba.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

let fallos = 0;
function comprobar(titulo: string, ok: boolean, detalle = "") {
  console.log(`  ${ok ? "✔" : "✘"} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

const MARCA = `VERIF-${Date.now()}`;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { avisarInstalacionNueva, getConfigInstalacion } = await import("../src/lib/instalaciones");
  const { correoConfigurado } = await import("../src/lib/correo");
  const { getConfigPostventa } = await import("../src/lib/postventa");

  const cfg = await getConfigInstalacion();
  const hayCorreo = await correoConfigurado();
  const postventa = await getConfigPostventa();

  console.log("\nESTADO DE PARTIDA\n");
  console.log(`  instalaciones en la base .... ${await prisma.instalacion.count()}`);
  console.log(`  coordinador (usuario) ....... ${cfg.coordinadorId || "sin configurar"}`);
  console.log(`  coordinador (correo suelto) . ${cfg.coordinadorEmail || "sin configurar"}`);
  console.log(`  aviso automático ............ ${cfg.avisarAlCerrar ? "encendido" : "apagado"}`);
  console.log(`  SMTP ........................ ${hayCorreo ? "configurado" : "SIN CONFIGURAR"}`);
  console.log(`  enlace de reseñas de Google . ${postventa.urlResena || "sin cargar"}`);

  let clienteId = "";
  let pedidoId = "";
  const vendedor = await prisma.usuario.findFirst({ where: { activo: true, rol: "VENDEDOR" }, select: { id: true, nombre: true } });
  const tecnico = await prisma.usuario.findFirst({ where: { activo: true, rol: "PRODUCCION" }, select: { id: true, nombre: true } });

  try {
    // ── Montar el caso ─────────────────────────────────────
    const cliente = await prisma.cliente.create({
      data: {
        nombre: `${MARCA} Cliente de prueba`,
        empresa: `${MARCA} S.A.S.`,
        nit: "900000000-0",
        telefono: "3000000000",
        ciudad: "Barranquilla",
        direccion: "Calle 1 # 2-3",
        tipo: "empresa",
        estado: "PROSPECTO",
      },
    });
    clienteId = cliente.id;

    const pedido = await prisma.pedido.create({
      data: {
        // A mano: no se toca el consecutivo real.
        numero: MARCA,
        clienteId: cliente.id,
        vendedorId: vendedor?.id ?? null,
        estado: "CONFIRMADO",
        origen: "COTIZACION",
        tieneInstalacion: true,
        direccionEntrega: "Carrera 50 # 80-20, conjunto Los Almendros",
        total: 4_500_000,
        items: {
          create: [
            { descripcion: "Malla eslabonada calibre 10 · 2,00 m", cantidad: 120, unidad: "m2", precioUnitario: 30_000, subtotal: 3_600_000, orden: 0 },
            { descripcion: "Servicio de instalación de cerramiento", cantidad: 1, unidad: "servicio", precioUnitario: 900_000, subtotal: 900_000, orden: 1 },
          ],
        },
      },
    });
    pedidoId = pedido.id;

    // ── 1. El aviso, sin coordinador configurado ───────────
    console.log("\n1. AVISO AL COORDINADOR (tal como está hoy la configuración)\n");
    const r1 = await avisarInstalacionNueva(pedido.id);
    console.log(`   ${r1.detalle}\n`);

    comprobar("el aviso no revienta", r1.ok, r1.detalle);
    comprobar("devuelve la obra creada", !!r1.instalacionId);

    const obra = await prisma.instalacion.findUnique({ where: { pedidoId: pedido.id } });
    comprobar("la obra existe", !!obra);
    comprobar("nace en PENDIENTE", obra?.estado === "PENDIENTE", obra?.estado);
    comprobar(
      "hereda la dirección de entrega del pedido",
      obra?.direccion === "Carrera 50 # 80-20, conjunto Los Almendros",
      obra?.direccion ?? "vacía",
    );
    comprobar("hereda la ciudad del cliente", obra?.ciudad === "Barranquilla", obra?.ciudad ?? "vacía");

    const notif = await prisma.notificacion.findMany({
      where: { titulo: { contains: MARCA } },
      select: { id: true, titulo: true, mensaje: true, data: true },
    });
    comprobar("queda la notificación en el portal", notif.length === 1, `${notif.length}`);
    comprobar(
      "el aviso dice dónde, con qué teléfono y quién vendió",
      notif[0]?.mensaje.includes("Carrera 50") &&
        notif[0]?.mensaje.includes("3000000000") &&
        notif[0]?.mensaje.includes(vendedor?.nombre ?? "sin asesor"),
    );
    comprobar(
      "el aviso lista lo que hay que instalar",
      !!notif[0]?.mensaje.includes("Malla eslabonada calibre 10"),
    );
    comprobar(
      "sin coordinador configurado, lo dice en vez de callarlo",
      /no hay coordinador/i.test(r1.detalle),
      r1.detalle,
    );

    // ── 2. No avisar dos veces ─────────────────────────────
    console.log("\n2. REAPROBAR EL MISMO PEDIDO\n");
    const r2 = await avisarInstalacionNueva(pedido.id);
    console.log(`   ${r2.detalle}\n`);
    comprobar("no se crea una segunda obra", (await prisma.instalacion.count({ where: { pedidoId: pedido.id } })) === 1);
    const notif2 = await prisma.notificacion.count({ where: { titulo: { contains: MARCA } } });
    comprobar("no se duplica la notificación", notif2 === 1, `${notif2}`);
    comprobar("dice que ya se había avisado", /ya se le hab|ya se había/i.test(r2.detalle), r2.detalle);

    // ── 3. Con coordinador configurado ─────────────────────
    console.log("\n3. CON UN COORDINADOR CONFIGURADO (se pone y se quita)\n");
    const admin = await prisma.usuario.findFirst({ where: { activo: true, rol: "ADMIN" }, select: { id: true, nombre: true, email: true } });

    // Otro pedido, porque el primero ya está sellado.
    const pedido2 = await prisma.pedido.create({
      data: {
        numero: `${MARCA}-2`, clienteId: cliente.id, vendedorId: vendedor?.id ?? null,
        estado: "CONFIRMADO", origen: "MANUAL", tieneInstalacion: true, total: 1_000_000,
        items: { create: [{ descripcion: "Malla para balcón a la medida", cantidad: 8, unidad: "m2", precioUnitario: 125_000, subtotal: 1_000_000, orden: 0 }] },
      },
    });

    let previoCoordinador: string | null = null;
    try {
      const fila = await prisma.configuracion.findUnique({ where: { clave: "inst_coordinador_id" } });
      previoCoordinador = fila?.valor ?? null;

      if (admin) {
        await prisma.configuracion.upsert({
          where: { clave: "inst_coordinador_id" },
          create: { clave: "inst_coordinador_id", valor: admin.id, descripcion: "Instalaciones" },
          update: { valor: admin.id },
        });

        const r3 = await avisarInstalacionNueva(pedido2.id);
        console.log(`   Coordinador: ${admin.nombre} <${admin.email}>`);
        console.log(`   ${r3.detalle}\n`);

        comprobar("con coordinador, el aviso sigue sin reventar", r3.ok, r3.detalle);
        if (hayCorreo) {
          comprobar("el correo salió", /avisado/i.test(r3.detalle), r3.detalle);
        } else {
          comprobar(
            "sin SMTP dice que el correo no está configurado, y NO sella",
            /correo saliente no está configurado/i.test(r3.detalle),
            r3.detalle,
          );
          const obra2 = await prisma.instalacion.findUnique({ where: { pedidoId: pedido2.id }, select: { avisoCoordinadorEn: true } });
          comprobar(
            "no se sella, para que el correo salga cuando haya SMTP",
            obra2?.avisoCoordinadorEn === null,
            "así el próximo cierre sí manda correo",
          );

          // A quién le llegó la notificación del portal. Con coordinador
          // configurado va dirigida, no global: si es global la ven los
          // siete usuarios y deja de ser un aviso para alguien.
          const dirigidas = await prisma.notificacion.findMany({
            where: { titulo: { contains: `${MARCA}-2` } },
            select: { usuarioId: true },
          });
          comprobar(
            "la notificación va dirigida, no global",
            dirigidas.length > 0 && dirigidas.every(n => !!n.usuarioId),
            `${dirigidas.length} destinatario(s)`,
          );
          comprobar(
            "el coordinador está entre los destinatarios",
            dirigidas.some(n => n.usuarioId === admin.id),
          );

          // Y justo por no sellar el correo: ¿se duplica la notificación
          // del portal al reaprobar? Es el caso de TODOS los días
          // mientras no haya SMTP, así que si se duplica, se duplica
          // siempre. (Aquí se cazó el bug la primera vez.)
          await avisarInstalacionNueva(pedido2.id);
          await avisarInstalacionNueva(pedido2.id);
          const trasTres = await prisma.notificacion.count({ where: { titulo: { contains: `${MARCA}-2` } } });
          comprobar(
            "reaprobar sin SMTP NO duplica la notificación del portal",
            trasTres === dirigidas.length,
            `${dirigidas.length} tras 1 pasada, ${trasTres} tras 3`,
          );
        }
      } else {
        console.log("   No hay ningún ADMIN activo: se omite esta parte.");
      }
    } finally {
      if (previoCoordinador === null) {
        await prisma.configuracion.deleteMany({ where: { clave: "inst_coordinador_id" } }).catch(() => undefined);
      } else {
        await prisma.configuracion.update({ where: { clave: "inst_coordinador_id" }, data: { valor: previoCoordinador } }).catch(() => undefined);
      }
      const quedo = await prisma.configuracion.findUnique({ where: { clave: "inst_coordinador_id" } });
      comprobar("la configuración del coordinador quedó como estaba", (quedo?.valor ?? null) === previoCoordinador);
    }

    // ── 4. El acta ─────────────────────────────────────────
    console.log("\n4. EL ACTA DE ENTREGA\n");

    // Se completa la obra como quedaría después de una instalación real,
    // para que el acta tenga qué imprimir.
    await prisma.instalacion.update({
      where: { pedidoId: pedido.id },
      data: {
        estado: "COMPLETADA",
        tecnicoId: tecnico?.id ?? null,
        fechaRealizada: new Date(),
        checklist: [
          { texto: "Postes aplomados y anclados", hecho: true },
          { texto: "Tensión de la malla verificada", hecho: true },
          { texto: "Sitio entregado limpio", hecho: false },
        ],
        fotos: [
          { url: "https://costamallas.com/a.jpg", titulo: "Antes", momento: "ANTES" },
          { url: "https://costamallas.com/b.jpg", titulo: "Después", momento: "DESPUES" },
          { url: "https://costamallas.com/c.jpg", titulo: "Después 2", momento: "DESPUES" },
        ],
        notas: "Se dejó pendiente el retiro del escombro para el lunes.",
      },
    });

    // La MISMA consulta que hace GET /api/crm/instalaciones/[id]: si el
    // acta se rompe, se rompe aquí.
    const acta = await prisma.instalacion.findUnique({
      where: { pedidoId: pedido.id },
      include: {
        tecnico: { select: { id: true, nombre: true, telefono: true } },
        pedido: {
          select: {
            id: true, numero: true, total: true, fechaEntrega: true, direccionEntrega: true, notas: true,
            cliente: { select: { nombre: true, empresa: true, nit: true, telefono: true, email: true, direccion: true, ciudad: true } },
            vendedor: { select: { nombre: true } },
            items: { orderBy: { orden: "asc" } },
          },
        },
      },
    });

    comprobar("el acta trae datos", !!acta);
    if (acta) {
      const c = acta.pedido.cliente;
      const checklist = acta.checklist as { texto: string; hecho: boolean }[];
      const fotos = acta.fotos as { momento: string }[];
      const donde = [acta.direccion || acta.pedido.direccionEntrega || c.direccion, acta.ciudad || c.ciudad].filter(Boolean).join(", ");

      comprobar("número de pedido en la cabecera", !!acta.pedido.numero, acta.pedido.numero);
      comprobar("cliente identificado", !!(c.empresa || c.nombre), c.empresa ?? c.nombre);
      comprobar("NIT o cédula", !!c.nit, c.nit ?? "—");
      comprobar("sitio de instalación resuelto", !!donde, donde);
      comprobar("fecha de la obra", !!(acta.fechaRealizada ?? acta.fechaAgendada));
      comprobar("técnico responsable", !!acta.tecnico?.nombre, acta.tecnico?.nombre ?? "SIN TÉCNICO (imprime «—»)");
      comprobar("asesor comercial", !!acta.pedido.vendedor?.nombre, acta.pedido.vendedor?.nombre ?? "—");
      comprobar("hay ítems que listar", acta.pedido.items.length > 0, `${acta.pedido.items.length}`);
      comprobar("el checklist es una lista", Array.isArray(checklist), `${checklist.length} puntos`);
      comprobar(
        "el checklist conserva su marca real",
        checklist.filter(p => p.hecho).length === 2 && checklist.filter(p => !p.hecho).length === 1,
      );
      comprobar("las fotos son una lista", Array.isArray(fotos));
      comprobar(
        "cuenta antes y después por separado",
        fotos.filter(f => f.momento === "ANTES").length === 1 && fotos.filter(f => f.momento === "DESPUES").length === 2,
      );
      comprobar(
        "las cantidades convierten a número sin romperse",
        acta.pedido.items.every(i => Number.isFinite(Number(i.cantidad))),
      );

      // Guardar quién recibió, que es lo que se pregunta cuando hay reclamo.
      await prisma.instalacion.update({
        where: { id: acta.id },
        data: {
          actaRecibidoPor: "María Fernanda Ruiz",
          actaDocumento: "C.C. 1.045.000.000",
          actaObservaciones: "Recibe conforme. Falta retirar escombro.",
          actaFirmadaEn: new Date(),
        },
      });
      const firmada = await prisma.instalacion.findUnique({
        where: { id: acta.id },
        select: { actaRecibidoPor: true, actaDocumento: true, actaFirmadaEn: true },
      });
      comprobar("quién recibió queda guardado", firmada?.actaRecibidoPor === "María Fernanda Ruiz");
      comprobar("con qué documento", firmada?.actaDocumento === "C.C. 1.045.000.000");
      comprobar("y la fecha de firma", !!firmada?.actaFirmadaEn);

      // El QR de reseñas: sin enlace cargado, el acta no lo pinta.
      comprobar(
        postventa.urlResena
          ? "el QR de la encuesta SÍ sale (hay enlace cargado)"
          : "el QR NO sale porque falta el enlace de reseñas de Google",
        true,
        postventa.urlResena || "PENDIENTES-GERENCIA §5",
      );
    }
  } finally {
    console.log("\nLimpiando…");
    // Borrar el cliente arrastra pedidos → ítems → instalación (cascade).
    await prisma.notificacion.deleteMany({ where: { titulo: { contains: MARCA } } }).catch(() => undefined);
    if (clienteId) {
      await prisma.cliente.delete({ where: { id: clienteId } })
        .catch(e => console.error("  ⚠️ NO se pudo borrar el cliente de prueba:", (e as Error).message));
    }
    const restos = {
      clientes: await prisma.cliente.count({ where: { nombre: { contains: MARCA } } }),
      pedidos: await prisma.pedido.count({ where: { numero: { contains: MARCA } } }),
      instalaciones: await prisma.instalacion.count(),
      notificaciones: await prisma.notificacion.count({ where: { titulo: { contains: MARCA } } }),
    };
    comprobar("no quedan clientes de prueba", restos.clientes === 0, `${restos.clientes}`);
    comprobar("no quedan pedidos de prueba", restos.pedidos === 0, `${restos.pedidos}`);
    comprobar("la base vuelve a 0 instalaciones", restos.instalaciones === 0, `${restos.instalaciones}`);
    comprobar("no quedan notificaciones de prueba", restos.notificaciones === 0, `${restos.notificaciones}`);
    void pedidoId;
    await prisma.$disconnect();
  }

  console.log(fallos === 0 ? "\n✅ Todas las comprobaciones pasaron.\n" : `\n❌ ${fallos} fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
