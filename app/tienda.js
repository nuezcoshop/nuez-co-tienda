"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { armarCatalogo, disponible, formatoCantidad, money, normalizarTexto, precioPorCantidad } from "@/lib/catalogo";

const CLAVE_CARRITO = "nuezco_carrito_v1";
const MONTOS_PESO = [0.1, 0.25, 0.5, 1];

function redondear(n) {
  return Math.round(n * 1000) / 1000;
}

export default function Tienda({ productos, banners, config, hayError }) {
  const { items, porId } = useMemo(() => armarCatalogo(productos), [productos]);
  const [carrito, setCarrito] = useState({}); // { productoId: cantidad }
  const [listo, setListo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [abierto, setAbierto] = useState(false);

  // Recupera el carrito guardado en este celular (y lo ajusta a lo que hay hoy).
  useEffect(() => {
    try {
      const guardado = JSON.parse(window.localStorage.getItem(CLAVE_CARRITO) || "{}");
      const limpio = {};
      Object.entries(guardado).forEach(([id, c]) => {
        const row = porId[id];
        const max = row ? disponible(row) : 0;
        const cant = Math.min(Number(c) || 0, max);
        if (row && cant > 0) limpio[id] = redondear(cant);
      });
      setCarrito(limpio);
    } catch (e) {
      // sin carrito guardado
    }
    setListo(true);
  }, [porId]);

  useEffect(() => {
    if (!listo) return;
    try {
      window.localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    } catch (e) {
      // el carrito funciona igual aunque no se pueda guardar
    }
  }, [carrito, listo]);

  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);

  function agregar(id, cantidad) {
    const row = porId[id];
    if (!row) return;
    setCarrito((prev) => {
      const nueva = Math.min(redondear((prev[id] || 0) + cantidad), disponible(row));
      if (nueva <= 0) {
        const { [id]: _quitado, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: nueva };
    });
  }

  function fijar(id, cantidad) {
    setCarrito((prev) => {
      if (cantidad <= 0) {
        const { [id]: _quitado, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: cantidad };
    });
  }

  const lineas = Object.entries(carrito)
    .map(([id, cantidad]) => {
      const row = porId[id];
      if (!row) return null;
      const precio = precioPorCantidad(row, cantidad);
      return { id, row, cantidad, precio, subtotal: precio * cantidad };
    })
    .filter(Boolean);
  const total = lineas.reduce((a, l) => a + l.subtotal, 0);
  const cantidadLineas = lineas.length;

  const categorias = useMemo(() => {
    const set = new Set();
    items.forEach((i) => i.categoria && set.add(i.categoria));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const q = normalizarTexto(busqueda);
  const visibles = items
    .filter((i) => (!categoria || i.categoria === categoria) && (!q || normalizarTexto(i.nombre).includes(q)))
    .sort((a, b) => Number(b.hayStock) - Number(a.hayStock));

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 bg-[var(--crema)]/95 backdrop-blur border-b border-[var(--borde)]">
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h1 className="titulo text-2xl font-semibold text-[var(--nogal)]">{config.nombre}</h1>
            <span className="text-xs text-[var(--tinta-suave)]">Productos naturales</span>
          </div>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos…"
            className="w-full h-11 px-4 rounded-full bg-white border border-[var(--borde)] outline-none focus:border-[var(--nogal)] text-base"
          />
          {categorias.length > 0 && (
            <div className="flex gap-2 overflow-x-auto sin-barra mt-2 -mx-4 px-4 pb-1">
              <Chip activo={categoria === ""} onClick={() => setCategoria("")}>
                Todos
              </Chip>
              {categorias.map((c) => (
                <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        <Banners banners={banners} nombre={config.nombre} bienvenida={config.bienvenida} />

        {hayError && (
          <p className="my-6 text-center text-sm text-[var(--tinta-suave)]">
            No pudimos cargar los productos en este momento. Probá de nuevo en unos minutos.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
          {visibles.map((item) => (
            <Tarjeta key={item.id} item={item} carrito={carrito} agregar={agregar} fijar={fijar} />
          ))}
        </div>
        {!hayError && visibles.length === 0 && (
          <p className="my-10 text-center text-[var(--tinta-suave)]">No encontramos productos con esa búsqueda.</p>
        )}

        <footer className="mt-10 mb-4 text-center text-xs text-[var(--tinta-suave)] space-y-1">
          {config.direccion && <p>Retiro en sucursal: {config.direccion}</p>}
          {config.horario && <p>{config.horario}</p>}
        </footer>
      </main>

      {cantidadLineas > 0 && !abierto && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-[var(--crema)] via-[var(--crema)]/95 to-transparent">
          <button
            onClick={() => setAbierto(true)}
            className="max-w-5xl mx-auto w-full h-14 rounded-2xl bg-[var(--musgo)] text-white flex items-center justify-between px-5 shadow-lg active:scale-[0.99]"
          >
            <span className="font-medium">
              Ver pedido ({cantidadLineas} {cantidadLineas === 1 ? "producto" : "productos"})
            </span>
            <span className="font-semibold">{money(total)}</span>
          </button>
        </div>
      )}

      {abierto && (
        <Pedido
          lineas={lineas}
          total={total}
          config={config}
          agregar={agregar}
          fijar={fijar}
          vaciar={() => setCarrito({})}
          cerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}

function Chip({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-9 px-4 rounded-full text-sm border ${
        activo ? "bg-[var(--nogal)] text-white border-[var(--nogal)]" : "bg-white text-[var(--tinta)] border-[var(--borde)]"
      }`}
    >
      {children}
    </button>
  );
}

function Banners({ banners, nombre, bienvenida }) {
  const contenedor = useRef(null);
  const [actual, setActual] = useState(0);

  useEffect(() => {
    if (!banners || banners.length < 2) return;
    const t = setInterval(() => {
      const el = contenedor.current;
      if (!el) return;
      const siguiente = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length;
      el.scrollTo({ left: siguiente * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, [banners]);

  if (!banners || banners.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-[var(--crema-2)] border border-[var(--borde)] px-5 py-6 text-center">
        <p className="titulo text-xl text-[var(--nogal)]">Bienvenido a {nombre}</p>
        <p className="text-sm text-[var(--tinta-suave)] mt-1">{bienvenida || "Elegí tus productos y cerrá el pedido por WhatsApp."}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div
        ref={contenedor}
        onScroll={(e) => setActual(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex overflow-x-auto snap-x snap-mandatory sin-barra rounded-2xl"
      >
        {banners.map((b, idx) => {
          const imagen = (
            <img
              src={b.imagen_url}
              alt={b.titulo || "Promoción"}
              loading={idx === 0 ? "eager" : "lazy"}
              decoding="async"
              className="w-full h-full object-cover"
            />
          );
          return (
            <div key={b.id} className="snap-center shrink-0 w-full aspect-[12/5] bg-[var(--crema-2)]">
              {b.enlace ? (
                <a href={b.enlace} className="block w-full h-full">
                  {imagen}
                </a>
              ) : (
                imagen
              )}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((b, idx) => (
            <span key={b.id} className={`h-1.5 rounded-full transition-all ${idx === actual ? "w-4 bg-[var(--nogal)]" : "w-1.5 bg-[var(--borde)]"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ item, carrito, agregar, fijar }) {
  const tieneTramos = (item.tramos || []).length > 0;
  const opciones = item.tipo === "variantes" ? item.variantes : [item];

  let precioTexto = "";
  if (item.tipo === "variantes") {
    const minimo = Math.min(...item.variantes.map((v) => v.precio_venta));
    precioTexto = "Desde " + money(minimo);
  } else if (item.tipo === "peso") {
    precioTexto = money(item.precio_venta) + " /kg";
  } else {
    precioTexto = money(item.precio_venta);
  }

  return (
    <div className={`bg-white rounded-2xl border border-[var(--borde)] overflow-hidden flex flex-col ${item.hayStock ? "" : "opacity-60"}`}>
      <div className="aspect-square bg-[var(--crema-2)] relative">
        {item.foto_url ? (
          <img src={item.foto_url} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🌰</div>
        )}
        {!item.hayStock && (
          <span className="absolute top-2 left-2 text-xs bg-[var(--tinta)] text-white px-2 py-1 rounded-full">Agotado</span>
        )}
        {item.hayStock && tieneTramos && (
          <span className="absolute top-2 left-2 text-xs bg-[var(--musgo)] text-white px-2 py-1 rounded-full">Precio por cantidad</span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">{item.nombre}</p>
        <p className="text-[var(--nogal)] font-semibold">{precioTexto}</p>

        {item.hayStock && item.tipo === "variantes" && (
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {opciones
              .filter((v) => disponible(v) > 0)
              .map((v) => {
                const enCarrito = carrito[v.id] || 0;
                const etiqueta = Number(v.cantidad_por_unidad) > 0 ? formatoCantidad(Number(v.cantidad_por_unidad), "kg") : v.nombre;
                return (
                  <button
                    key={v.id}
                    onClick={() => agregar(v.id, 1)}
                    className={`h-10 px-3 rounded-xl text-xs border flex flex-col items-center justify-center leading-tight ${
                      enCarrito > 0 ? "bg-[var(--musgo)] text-white border-[var(--musgo)]" : "bg-[var(--crema)] border-[var(--borde)]"
                    }`}
                  >
                    <span className="font-medium">{enCarrito > 0 ? `${etiqueta} ×${enCarrito}` : etiqueta}</span>
                    <span className="opacity-80">{money(precioPorCantidad(v, 1))}</span>
                  </button>
                );
              })}
          </div>
        )}

        {item.hayStock && item.tipo === "peso" && (
          <div className="mt-auto">
            <div className="flex flex-wrap gap-1.5">
              {MONTOS_PESO.filter((m) => m <= disponible(item) + 1e-9).map((m) => (
                <button
                  key={m}
                  onClick={() => agregar(item.id, m)}
                  className="h-10 px-3 rounded-xl text-xs border bg-[var(--crema)] border-[var(--borde)] flex flex-col items-center justify-center leading-tight"
                >
                  <span className="font-medium">+ {formatoCantidad(m, "kg")}</span>
                  <span className="opacity-70">{money(precioPorCantidad(item, m) * m)}</span>
                </button>
              ))}
            </div>
            {carrito[item.id] > 0 && (
              <p className="text-xs text-[var(--musgo)] font-medium mt-1.5">En tu pedido: {formatoCantidad(carrito[item.id], "kg")}</p>
            )}
          </div>
        )}

        {item.hayStock && item.tipo === "unidad" && (
          <div className="mt-auto">
            {carrito[item.id] > 0 ? (
              <div className="flex items-center justify-between h-10 rounded-xl bg-[var(--musgo)] text-white">
                <button className="w-12 h-10 text-lg" onClick={() => agregar(item.id, -1)} aria-label="Quitar uno">
                  −
                </button>
                <span className="font-medium">{carrito[item.id]}</span>
                <button className="w-12 h-10 text-lg" onClick={() => agregar(item.id, 1)} aria-label="Agregar uno">
                  +
                </button>
              </div>
            ) : (
              <button onClick={() => agregar(item.id, 1)} className="w-full h-10 rounded-xl bg-[var(--nogal)] text-white text-sm font-medium active:scale-[0.99]">
                Agregar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Pedido({ lineas, total, config, agregar, fijar, vaciar, cerrar }) {
  const [entrega, setEntrega] = useState("retiro");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [pago, setPago] = useState("Efectivo");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");

  // Los datos del cliente se recuerdan en este celular para la próxima compra.
  useEffect(() => {
    try {
      const d = JSON.parse(window.localStorage.getItem("nuezco_cliente_v1") || "{}");
      if (d.nombre) setNombre(d.nombre);
      if (d.direccion) setDireccion(d.direccion);
    } catch (e) {
      // sin datos guardados
    }
  }, []);

  const gratis = config.envioGratisDesde > 0 && total >= config.envioGratisDesde;
  const faltaParaGratis = config.envioGratisDesde > 0 ? Math.max(config.envioGratisDesde - total, 0) : 0;

  function enviar() {
    setError("");
    if (lineas.length === 0) return setError("Tu pedido está vacío.");
    if (!nombre.trim()) return setError("Escribí tu nombre.");
    if (entrega === "envio" && !direccion.trim()) return setError("Escribí la dirección de entrega.");
    if (!config.whatsapp) return setError("La tienda todavía no tiene un WhatsApp configurado.");

    try {
      window.localStorage.setItem("nuezco_cliente_v1", JSON.stringify({ nombre: nombre.trim(), direccion: direccion.trim() }));
    } catch (e) {
      // no es importante
    }

    const detalle = lineas.map((l) => {
      const nombreProd = l.row.nombre;
      const cant = l.row.unidad === "kg" ? `${formatoCantidad(l.cantidad, "kg")} de ${nombreProd}` : `${l.cantidad} × ${nombreProd}`;
      return `• ${cant} — ${money(l.subtotal)}`;
    });

    let lineaEntrega = "Entrega: Retiro en sucursal";
    if (entrega === "envio") {
      lineaEntrega = `Entrega: Envío a domicilio (${direccion.trim()}) — ${gratis ? "envío gratis" : "costo a coordinar con la cadetería"}`;
    }

    const texto = [
      `Hola ${config.nombre}! Quiero hacer este pedido:`,
      "",
      ...detalle,
      "",
      `Total de productos: ${money(total)}`,
      lineaEntrega,
      `Medio de pago: ${pago}`,
      `Nombre: ${nombre.trim()}`,
      notas.trim() ? `Notas: ${notas.trim()}` : null,
    ]
      .filter((x) => x !== null)
      .join("\n");

    window.location.href = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(texto)}`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={cerrar}>
      <div
        className="bg-[var(--crema)] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--crema)] flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--borde)]">
          <h2 className="titulo text-xl font-semibold text-[var(--nogal)]">Tu pedido</h2>
          <button onClick={cerrar} className="w-10 h-10 text-xl text-[var(--tinta-suave)]" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="px-5 py-3">
          {lineas.length === 0 && <p className="py-6 text-center text-[var(--tinta-suave)]">Todavía no agregaste productos.</p>}
          {lineas.map((l) => {
            const paso = l.row.unidad === "kg" ? 0.1 : 1;
            return (
              <div key={l.id} className="flex items-center gap-3 py-3 border-b border-[var(--borde)] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{l.row.nombre}</p>
                  <p className="text-xs text-[var(--tinta-suave)]">
                    {l.row.unidad === "kg" ? formatoCantidad(l.cantidad, "kg") : `${l.cantidad} un.`} · {money(l.precio)}
                    {l.row.unidad === "kg" ? " /kg" : " c/u"}
                  </p>
                </div>
                <div className="flex items-center rounded-xl border border-[var(--borde)] bg-white">
                  <button className="w-10 h-10 text-lg" onClick={() => (l.cantidad - paso <= 0.0001 ? fijar(l.id, 0) : agregar(l.id, -paso))} aria-label="Quitar">
                    −
                  </button>
                  <button className="w-10 h-10 text-lg" onClick={() => agregar(l.id, paso)} aria-label="Agregar">
                    +
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-semibold">{money(l.subtotal)}</p>
              </div>
            );
          })}
          {lineas.length > 0 && (
            <button
              onClick={() => confirm("¿Vaciar el pedido?") && vaciar()}
              className="text-xs text-[var(--tinta-suave)] underline mt-2"
            >
              Vaciar pedido
            </button>
          )}
        </div>

        {lineas.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-sm font-medium mb-2">¿Cómo lo recibís?</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Opcion activo={entrega === "retiro"} onClick={() => setEntrega("retiro")}>
                Retiro en sucursal
              </Opcion>
              <Opcion activo={entrega === "envio"} onClick={() => setEntrega("envio")}>
                Envío a domicilio
              </Opcion>
            </div>
            {entrega === "retiro" && (config.direccion || config.horario) && (
              <p className="text-xs text-[var(--tinta-suave)] mb-3">
                {config.direccion}
                {config.direccion && config.horario ? " · " : ""}
                {config.horario}
              </p>
            )}
            {entrega === "envio" && (
              <div className="mb-3">
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Dirección de entrega"
                  className="w-full h-11 px-3 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--nogal)] text-base"
                />
                <p className={`text-xs mt-1.5 ${gratis ? "text-[var(--musgo)] font-medium" : "text-[var(--tinta-suave)]"}`}>
                  {gratis
                    ? "¡Tu envío es gratis!"
                    : config.envioGratisDesde > 0
                    ? `Costo de envío a coordinar con la cadetería. Te faltan ${money(faltaParaGratis)} para envío gratis.`
                    : "Costo de envío a coordinar con la cadetería."}
                </p>
              </div>
            )}

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full h-11 px-3 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--nogal)] text-base mb-2"
            />
            <select
              value={pago}
              onChange={(e) => setPago(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[var(--borde)] bg-white outline-none text-base mb-2"
            >
              <option>Efectivo</option>
              <option>Transferencia</option>
            </select>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--nogal)] text-base"
            />

            <div className="flex items-center justify-between mt-4 mb-3">
              <span className="text-sm text-[var(--tinta-suave)]">Total de productos</span>
              <span className="text-xl font-semibold">{money(total)}</span>
            </div>
            {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
            <button onClick={enviar} className="w-full h-14 rounded-2xl bg-[#1f9d55] text-white font-semibold text-base active:scale-[0.99]">
              Enviar pedido por WhatsApp
            </button>
            <p className="text-xs text-center text-[var(--tinta-suave)] mt-2">Se abre WhatsApp con tu pedido listo para enviar. Confirmamos stock y total por ahí.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Opcion({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`h-12 rounded-xl text-sm border ${activo ? "bg-[var(--nogal)] text-white border-[var(--nogal)]" : "bg-white border-[var(--borde)]"}`}
    >
      {children}
    </button>
  );
}
