# Inventario de campos ACF — Costamallas ERP

> Documento de referencia (generado 2026-07-09). Resume **todos** los campos ACF/personalizados
> del proyecto y dónde vive cada uno. Pensado para pasar a otra sesión.

## Mapa rápido de dónde viven los ACF

| Fuente | Almacenamiento | ¿Se sincroniza a WooCommerce? |
|---|---|---|
| **A. ACF generales** | Columnas `acf*` de la tabla `productos` | ✅ Sí, como `meta_data` (11 claves) |
| **B. Fichas técnicas por categoría** | JSON `productos.acfExtra` (claves `mm_/bh_/ny_/pl_/sp_`) | ❌ No (hoy se quedan en el CRM) |
| **C. Tablas Prisma normalizadas** | `acf_mallas_metalicas`, `acf_balcones`, `acf_nylon`, `acf_plasticas`, `acf_seguridad_perimetral` | ❌ No — **parecen legacy**; el formulario NO escribe aquí, escribe en `acfExtra` (B) |
| **D. Campos dinámicos por categoría** | `configuracion.campos_categoria` (JSON, definidos por admin en *Catálogos*) → guardados en `acfExtra` | ❌ No |

> ⚠️ **Los campos que "creaste últimamente"** desde *Catálogos* (admin) son la fuente **D** y viven
> en la BD (`configuracion.campos_categoria`), **no en el código**. No se pueden listar sin acceso a
> la BD. Para verlos: con sesión iniciada, abrir `GET /api/categorias/campos` (devuelve el JSON
> `{ categoria: [{key,label,tipo,unidad,opciones}] }`) y pegarlo aquí.

---

## A. ACF generales (columnas de `productos` → meta_data de WooCommerce)

Son los que **sí** viajan a la tienda. `meta key` = nombre exacto que debe tener el campo ACF en WordPress.

| Columna ERP | meta key WC | Tipo | Notas |
|---|---|---|---|
| `acfSkuInterno` | `sku_interno` | text | |
| `acfMarcaFabricante` | `marca_fabricante` | text | |
| `acfUnidadVenta` | `unidad_venta` | text/select | m2, ml, und, rollo, panel, kit, par |
| `acfFabricacionMedida` | `fabricacion_medida` | true_false | |
| `acfInstalacion` | `instalacion_disponible` | true_false | |
| `acfGarantiaAnos` | `garantia_anos` | number | |
| `acfAplicaciones` | `aplicaciones` | textarea | `string[]` unido con ` \| ` |
| `acfColores` | `colores_disponibles` | textarea | `string[]` unido con ` \| ` |
| `acfNormas` | `normas_calidad` | textarea | `string[]` unido con ` \| ` |
| `acfCertificaciones` | `certificaciones` | textarea | `string[]` unido con ` \| ` |
| `acfFichaTecnicaPdf` | `ficha_tecnica_pdf` | url | |

📦 **Import listo para WordPress:** `docs/acf-costamallas-productos.json`
(ACF → Herramientas → Importar grupos de campos). Cubre **solo** estos 11.

---

## B. Fichas técnicas por categoría (código → `acfExtra` JSON)

Definidas en `src/components/productos/ProductoFormDinamico.tsx` (componentes `FichaMetalicas`,
`FichaBalcones`, `FichaNylon`, `FichaPlasticas`, `FichaSeguridad`). Se guardan como claves dentro
del JSON `acfExtra`. **Hoy NO se envían a WooCommerce.**

### B.1 Mallas Metálicas — prefijo `mm_` (activa con categoría `mallas-metalicas`)
| key | Etiqueta | Tipo |
|---|---|---|
| `mm_tipo_acero` | Tipo de Acero | select (galvanizado, galvanizado_pvc, inoxidable, negro) |
| `mm_acabado_exterior` | Acabado Exterior | select (zinc_electro, zinc_caliente, pvc, epoxi, sin_recubrimiento) |
| `mm_zinc_gr_m2` | Zinc (g/m²) | number |
| `mm_certificacion_leed` | Certificación LEED | booleano |
| `mm_calibre_ext_bwg` | Calibre Externo BWG | text |
| `mm_calibre_ext_mm` | Calibre Externo (mm) | number |
| `mm_calibre_int_bwg` | Calibre Interno BWG | text |
| `mm_calibre_int_mm` | Calibre Interno (mm) | number |
| `mm_tamano_ojo` | Tamaño del Ojo / Abertura | text |
| `mm_resistencia_tension_mpa` | Resistencia Tensión (MPa) | number |
| `mm_resistencia_traccion_kn` | Resistencia Tracción (kN/m) | number |
| `mm_dureza_shore_a` | Dureza Shore A (PVC) | number |
| `mm_horas_camara_salina` | Horas Cámara Salina | number |
| `mm_compatibilidad_quimica` | Compatibilidad Química | textarea |
| `mm_alto_m` | Alto (m) | number |
| `mm_ancho_m` | Ancho (m) | number |
| `mm_longitud_rollo_m` | Longitud Rollo (m) | number |
| `mm_peso_kg` | Peso (kg) | number |
| `mm_incluye_abrazaderas` | Incluye Abrazaderas | booleano |
| `mm_tabla_variantes` | Tabla de Variantes | repeater (var_hueco, var_calibre, var_unidad[m2/ml/rollo/panel], var_peso) |

### B.2 Balcones / Hogar — prefijo `bh_` (categoría `mallas-para-balcones`)
| key | Etiqueta | Tipo |
|---|---|---|
| `bh_material_filamento` | Material del Filamento | select (poliester, polipropileno, nylon, polietileno) |
| `bh_diametro_hilo_mm` | Diámetro del Hilo (mm) | number |
| `bh_denier` | Denier | number |
| `bh_titulo_hilo` | Título del Hilo | text |
| `bh_tenacidad_g_denier` | Tenacidad (g/denier) | number |
| `bh_elongacion_pct` | Elongación (%) | number |
| `bh_resistencia_traccion_kgf` | Resistencia Tracción (kgf) | number |
| `bh_resistencia_impacto_j` | Resistencia al Impacto (J) | number |
| `bh_carga_kg_m2` | Carga Admisible (kg/m²) | number |
| `bh_tamano_abertura` | Tamaño de Abertura | text |
| `bh_ancho_estandar_m` | Ancho Estándar (m) | number |
| `bh_largo_estandar_m` | Largo Estándar (m) | number |
| `bh_estabilidad_dimensional_pct` | Estabilidad Dimensional (%) | number |
| `bh_temp_max_uso_c` | Temperatura Máxima (°C) | number |
| `bh_estabilizador_uv` | Estabilizador UV | select (uv_estabilizado, uv_no, uv_premium) |
| `bh_norma_certificacion` | Norma / Certificación | text |
| `bh_espacios_aplicacion` | Espacios de Aplicación | multi-pill (balcon, ventana, escalera, terraza, piscina, rack, fachada, jardin) |
| `bh_kit_autoinstalable` | Kit Autoinstalable | booleano |
| `bh_accesorios_incluidos` | Accesorios Incluidos | repeater (accesorio_item, accesorio_qty) |

### B.3 Nylon / Deportivas — prefijo `ny_` (categoría `mallas-nylon`)
| key | Etiqueta | Tipo |
|---|---|---|
| `ny_tipo_tejido` | Tipo de Tejido | select (mano, maquina, extruido) |
| `ny_calibre_mm` | Calibre del Hilo (mm) | number |
| `ny_tamano_cuadro` | Tamaño del Cuadro | text |
| `ny_tiene_alma` | Tiene Alma Interior | booleano |
| `ny_uso_deportivo` | Uso Principal | select (futbol, voleibol, tenis, basquetbol, cerramiento, cubierta, anticaida, beisbol, golf) |
| `ny_norma_anticaida` | Norma Anticaída | text |
| `ny_alto_reglamentario_m` | Alto Reglamentario (m) | number |
| `ny_ancho_reglamentario_m` | Ancho Reglamentario (m) | number |
| `ny_prof_superior_m` | Profundidad Superior (m) | number |
| `ny_prof_inferior_m` | Profundidad Inferior (m) | number |
| `ny_incluye_lona` | Incluye Lona / Faldón | booleano |
| `ny_ref_dicitex` | Referencia Dicitex | text |
| `ny_altura_fibra_mm` | Altura de Fibra (mm) | number |
| `ny_tasa_puntadas_m2` | Tasa Puntadas/m² | number |
| `ny_galga` | Galga | text |
| `ny_base_primaria` | Base Primaria | select (pp_tejido, poliester, pp_no_tejido) |
| `ny_base_secundaria` | Base Secundaria | select (latex, poliuretano, sin_base) |

### B.4 Plásticas — prefijo `pl_` (categoría `mallas-plasticas`)
| key | Etiqueta | Tipo |
|---|---|---|
| `pl_polimero_base` | Polímero Base | select (pead, pe, pp, pvc) |
| `pl_subtipo` | Subtipo de Malla | select (reja, pollito, polisombra, senalizacion, geomalla, gallinero, invernadero) |
| `pl_aditivo_uv` | Aditivo UV | booleano |
| `pl_forma_hueco` | Forma del Hueco | select (cuadrado, rectangular, rombo, hexagonal, circular) |
| `pl_tamano_abertura` | Tamaño de Abertura | text |
| `pl_alto_m` | Alto / Ancho (m) | number |
| `pl_largo_rollo_m` | Largo del Rollo (m) | number |
| `pl_porcentaje_sombra` | % Sombra | number |
| `pl_peso_kg_m2` | Peso (kg/m²) | number |
| `pl_color_estandar` | Color Estándar | select (verde, negro, naranja, amarillo, rojo, azul, blanco, gris) |

### B.5 Seguridad Perimetral — prefijo `sp_` (categoría `seguridad-perimetral`)
| key | Etiqueta | Tipo |
|---|---|---|
| `sp_subtipo` | Subtipo | select (concertina, alambre_puas, alambre_galv, alambre_pvc, alambre_cerca, energizador, aislador, varilla_tierra, sensor) |
| `sp_material_cuchillas` | Material Cuchillas / Alambre | select (acero_galv, acero_inox, acero_pvc) |
| `sp_calibre_bwg` | Calibre BWG | text |
| `sp_calibre_mm` | Calibre (mm) | number |
| `sp_tipo_concertina` | Tipo de Concertina | select (circular, flat_wrap, bto_22, bto-65, razor_wire) |
| `sp_diametro_rollo_mm` | Diámetro del Rollo (mm) | number |
| `sp_num_espirales` | Número de Espirales | number |
| `sp_rendimiento_ml` | Rendimiento (ml) | number |
| `sp_voltaje_v` | Voltaje de Salida (V) | number |
| `sp_cobertura_km` | Cobertura (km) | number |
| `sp_cobertura_ha` | Cobertura (ha) | number |
| `sp_control_remoto` | Incluye Control Remoto | booleano |
| `sp_peso_kg` | Peso (kg) | number |
| `sp_notas_instalacion` | Notas de Instalación | textarea |

**Total fichas por categoría (código): 80 campos.**

---

## C. Tablas Prisma normalizadas (posible legacy)

Existen en `prisma/schema.prisma` con relación 1-1 a `Producto`, pero **el formulario actual no las
escribe** (usa `acfExtra`). Revisar si siguen en uso antes de basarse en ellas.

- `acf_mallas_metalicas`: calibre, aperturaLuz, tipoAcero, tipoBano, rolloAncho, rolloLargo, acabado, normaFabricacion
- `acf_balcones`: materialMarco, acabadoMarco, tipoApertura, resistenciaViento, claseTermica
- `acf_nylon`: denier, trama, resistenciaUV, cargaRuptura
- `acf_plasticas`: material, densidad, porcentajeSombra, temperaturaMax
- `acf_seguridad_perimetral`: claseSeguridadEn, alturaMinimaRecom, sistemaAnclaje, resistenciaTraccion, certificacionIEC

---

## D. Campos dinámicos por categoría (admin, en BD)

- Definidos en **Catálogos** por un admin y guardados en `configuracion.campos_categoria` (JSON).
- Estructura: `{ [categoriaSlug]: [{ key, label, tipo: texto|numero|booleano|lista, unidad?, opciones? }] }`.
- Se renderizan en la pestaña *Ficha Técnica* (componente `CamposDinamicos`) y se guardan en `acfExtra`.
- **No están en el código** → para inventariarlos, leer `GET /api/categorias/campos` desde la app con sesión iniciada.

---

## Comparación con el ACF real de WordPress (export 2026-07-10)

Fuente: `acf-export-2026-07-10.json`. Grupos de producto encontrados en WP:
Campos Generales (`product`), y por `product_cat`: metálicas, balcones, nylon,
**construcción/anticaída**, plásticas, seguridad-perimetral. (Además grupos de
página del tema: mosaico de categorías y hero de video — no son de producto.)

### ✅ Coincidencias (nombres)
- **11/11** campos generales (A) existen en ACF.
- **80/80** campos de ficha por categoría (B) existen en ACF, con ubicación por
  `product_cat` = slug correcto. Excelente cobertura de nombres.

### ⚠️ Desajustes de TIPO a corregir (afectan cuando se sincronicen)
| Campo | ACF en WP | El CRM envía | Problema |
|---|---|---|---|
| `aplicaciones` | **repeater** (sub: `aplicacion_item`) | texto `a \| b \| c` | Un repeater NO lee un string plano; ACF lo guarda como filas. **Incompatible.** |
| `colores_disponibles` | **repeater** (sub: `color_item`, `color_muestra` imagen) | texto `a \| b` | Igual que arriba. Además `color_muestra` no existe en el CRM. |
| `ficha_tecnica_pdf` | **file** (espera ID de adjunto) | URL (string) | El campo file no resuelve una URL suelta. Usar `url`/`text` o subir a mediateca. |
| `normas_calidad` | text | texto `a \| b` | Funciona como string; ideal `textarea`. |
| `certificaciones` | textarea | texto `a \| b` | OK. |
| `unidad_venta` | select (m2/ml/und/rollo/panel/kit/par) | slug | ✓ coincide. |

**Recomendación (rápida):** en WP cambiar `aplicaciones` y `colores_disponibles`
de *repeater* → *textarea*, y `ficha_tecnica_pdf` de *file* → *url*. Así el sync
actual del CRM funciona sin tocar código. (Alternativa "nativa": adaptar el sync
para enviar formato repeater y subir PDF/imágenes a la mediateca — más trabajo.)

### 🟡 Campos ACF sin contraparte en el CRM (quedarán vacíos)
- `descripcion_corta` (general): el CRM manda la descripción corta por el campo
  **nativo** de WooCommerce (short_description), no como meta ACF.
- `ny_peso_fibra_g_m2`: campo extra de nylon que el CRM no tiene.
- **Grupo completo `co_*` (Construcción/Anticaída)** — 17 campos ACF
  (`co_tipo_sistema`, `co_norma`, `co_clase_energia`, `co_certificado`,
  `co_material`, `co_calibre_hilo_mm`, `co_cuadro_malla`, `co_diametro_cuerda_mm`,
  `co_energia_absorcion_j`, `co_ancho_m`, `co_largo_m`, `co_fabricacion_medida`,
  `co_colores`, `co_disponibilidad`, `co_aplicacion`, `co_notas_instalacion`):
  el CRM **no tiene ficha** para `mallas-para-construccion`. Para llenarla desde
  el CRM habría que crear ese componente de ficha en el formulario.

### 🟢 Gap funcional principal — RESUELTO (2026-07-10)
Antes, los 80 campos de ficha por categoría (B) NO se enviaban a WooCommerce.
Ya se implementó `acfExtraToMeta()` en `src/lib/woocommerce.ts`: el sync vuelca
las claves de `acfExtra` como `meta_data` (escalares tal cual, booleanos → 1/0,
arrays de escalares/checkbox como array). **Pendiente:** los 2 repeaters de
objetos (`mm_tabla_variantes`, `bh_accesorios_incluidos`) se **omiten** — ACF los
guarda en formato de filas y requieren un mapeo especial (o cambiar esos campos
ACF a otro tipo).

> Nota: el import `docs/acf-costamallas-productos.json` (11 generales) quedó
> **superado** por el ACF real de WP, que es más completo. Ya no hace falta importarlo.

## Pendientes conocidos
- Sincronizar B/C/D a WooCommerce (hoy solo van los 11 de A). Requiere: enviar `acfExtra` como
  meta y crear grupos ACF en WordPress con regla de ubicación por categoría de producto.
- Ampliar `docs/acf-costamallas-productos.json` con las fichas por categoría si se decide exportarlas.
