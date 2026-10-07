"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { costoEnvio, enlaceMapa } from "@/lib/envio";
import { supabase } from "@/lib/supabase";
import { armarCatalogo, disponible, formatoCantidad, money, normalizarTexto, precioPorCantidad } from "@/lib/catalogo";

// El mapa se descarga recién cuando el cliente elige envío a domicilio: no pesa en la carga normal.
const MapaEnvio = dynamic(() => import("./mapa-envio"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[60] bg-white/80 flex items-center justify-center text-sm font-semibold">Cargando mapa…</div>,
});

const TODOS = "__todos";
const CLAVE_CARRITO = "nuezco_carrito_v1";
const PASO_KG = 0.05; // se suma/resta de a 50 g
const ATAJOS_KG = [0.1, 0.25, 0.5, 1, 2];

// Cada producto al peso puede venderse de a 50 g (libre), 100 g, 250 g, 500 g o 1 kg: lo define el sistema.
function pasoDe(row) {
  if (row.unidad !== "kg") return 1;
  const p = Number(row.paso_venta);
  return p > 0 ? p : PASO_KG;
}
const por100 = (precioKg) => money(precioKg / 10) + " /100 g";
const textoPaso = (paso) => (paso >= 1 ? "de a 1 kg" : "de a " + formatoCantidad(paso, "kg"));

function redondear(n) {
  return Math.round(n * 1000) / 1000;
}

// Si pegaron el enlace sin "https://", se lo agregamos para que no se rompa.
function normalizarEnlace(url) {
  const u = String(url || "").trim();
  if (!u) return "#";
  if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(u) || u.startsWith("/") || u.startsWith("#")) return u;
  return "https://" + u;
}
function esExterno(url) {
  const u = normalizarEnlace(url);
  if (!/^https?:/i.test(u)) return false;
  try {
    return new URL(u).host !== window.location.host;
  } catch (e) {
    return true;
  }
}

function IconoCarrito({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.76L20 8H6.2" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  );
}

function IconoLupa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export default function Tienda({ productos, banners, destacados = [], config, fotosCategorias = {}, hayError }) {
  const { items, porId } = useMemo(() => armarCatalogo(productos), [productos]);
  const [carrito, setCarrito] = useState({}); // { productoId: cantidad }
  const [listo, setListo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null); // producto abierto
  const [aviso, setAviso] = useState("");

  // Enlaces directos (por ejemplo desde un banner): ?categoria=Granolas, ?buscar=yerba o ?producto=12
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const cat = sp.get("categoria");
      const bus = sp.get("buscar");
      const prod = sp.get("producto");
      if (cat) setCategoria(cat);
      if (bus) setBusqueda(bus);
      if (prod) {
        const it = items.find((i) => String(i.id) === prod || (i.variantes || []).some((v) => String(v.id) === prod));
        if (it) setDetalle(it);
      }
    } catch (e) {
      // sin parámetros
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    document.body.style.overflow = carritoAbierto || detalle ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [carritoAbierto, detalle]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  function agregar(id, cantidad) {
    const row = porId[id];
    if (!row) return;
    setCarrito((prev) => {
      const nueva = Math.min(redondear((prev[id] || 0) + cantidad), disponible(row));
      if (nueva <= 0.0001) {
        const { [id]: _quitado, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: nueva };
    });
  }

  function quitar(id) {
    setCarrito((prev) => {
      const { [id]: _quitado, ...resto } = prev;
      return resto;
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

  const q = normalizarTexto(busqueda).trim();
  const palabras = q ? q.split(/\s+/) : [];
  const visibles = items
    .filter((i) => {
      if (categoria && categoria !== TODOS && i.categoria !== categoria) return false;
      if (palabras.length === 0) return true;
      const texto = normalizarTexto(i.nombre + " " + (i.categoria || ""));
      return palabras.every((w) => texto.includes(w));
    })
    .sort((a, b) => Number(b.hayStock) - Number(a.hayStock) || a.nombre.localeCompare(b.nombre));

  // "Inicio" = sin categoría elegida ni búsqueda. "Todos" muestra el catálogo completo agrupado por categoría.
  const esInicio = !categoria && !q;
  const bannersPrincipal = (banners || []).filter((b) => (b.zona || "principal") === "principal");
  const bannersInicio = (banners || []).filter((b) => b.zona === "inicio");
  const productosDestacados = useMemo(() => {
    const vistos = new Set();
    const lista = [];
    destacados.forEach((id) => {
      const it = items.find((i) => String(i.id) === id || (i.variantes || []).some((v) => String(v.id) === id));
      if (it && it.hayStock && !vistos.has(it.id)) {
        vistos.add(it.id);
        lista.push(it);
      }
    });
    return lista;
  }, [destacados, items]);
  const enlaceUbicacion =
    config.ubicacionLink ||
    (config.sucursal
      ? `https://www.google.com/maps?q=${config.sucursal.lat},${config.sucursal.lng}`
      : config.direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.direccion)}`
      : "");

  function irAInicio() {
    setCategoria("");
    setBusqueda("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let grupos;
  if (categoria && categoria !== TODOS) {
    grupos = [{ titulo: categoria, items: visibles }];
  } else if (q) {
    grupos = [{ titulo: "Resultados", items: visibles }];
  } else {
    const mapa = {};
    visibles.forEach((i) => {
      const k = i.categoria || "Otros";
      (mapa[k] = mapa[k] || []).push(i);
    });
    grupos = Object.entries(mapa)
      .sort(([a], [b]) => (a === "Otros" ? 1 : b === "Otros" ? -1 : a.localeCompare(b)))
      .map(([titulo, its]) => ({ titulo, items: its }));
  }

  return (
    <div className="min-h-screen pb-28 bg-white">
      {(config.envioGratisDesde > 0 || config.direccion) && (
        <div className="bg-[var(--verde)] text-white text-center text-xs font-medium px-4 py-2">
          {config.envioGratisDesde > 0 ? `Envío gratis en compras desde ${money(config.envioGratisDesde)}` : `Retiro en sucursal: ${config.direccion}`}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <button onClick={irAInicio} aria-label="Ir al inicio" className="text-left">
            {config.logo ? (
              <img src={config.logo} alt={config.nombre} className="h-10 w-auto max-w-[200px] object-contain" />
            ) : (
              <h1 className="text-2xl font-extrabold text-[var(--verde)] tracking-tight">{config.nombre}</h1>
            )}
          </button>
          <button
            onClick={() => setCarritoAbierto(true)}
            className="relative w-11 h-11 rounded-full bg-[var(--verde-claro)] text-[var(--verde)] flex items-center justify-center"
            aria-label="Ver pedido"
          >
            <IconoCarrito />
            {cantidadLineas > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[var(--amarillo)] text-[var(--tinta)] text-xs font-bold flex items-center justify-center">
                {cantidadLineas}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[var(--borde)]">
        <div className="max-w-5xl mx-auto px-4 pt-2 pb-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--tinta-suave)]">
              <IconoLupa />
            </span>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar productos…"
              className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--fondo-suave)] outline-none focus:ring-2 focus:ring-[var(--verde)]/30 text-base"
            />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4">
        {categorias.length > 0 && (
          <div className="flex gap-3 overflow-x-auto sin-barra mt-3 -mx-4 px-4 pb-1">
            <CirculoCategoria nombre="Todos" activo={categoria === TODOS} onClick={() => setCategoria(TODOS)} todos />
            {categorias.map((c) => (
              <CirculoCategoria key={c} nombre={c} foto={fotosCategorias[c]} activo={categoria === c} onClick={() => setCategoria(c)} />
            ))}
          </div>
        )}

        {(bannersPrincipal.length > 0 || esInicio) && (
          <Banners banners={bannersPrincipal} nombre={config.nombre} bienvenida={config.bienvenida} />
        )}

        {esInicio && productosDestacados.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-bold text-[var(--verde)] mb-3">{config.destacadosTitulo}</h2>
            <div className="flex gap-3 overflow-x-auto sin-barra snap-x -mx-4 px-4 pb-2">
              {productosDestacados.map((item) => (
                <div key={item.id} className="w-40 shrink-0 snap-start flex">
                  <Tarjeta item={item} carrito={carrito} abrir={() => setDetalle(item)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {esInicio && bannersInicio.length > 0 && <Banners banners={bannersInicio} sinBienvenida />}

        {esInicio && (config.direccion || config.horario || enlaceUbicacion) && (
          <section className="mt-6 rounded-2xl bg-[var(--fondo-suave)] p-5">
            <h2 className="text-lg font-bold text-[var(--verde)] mb-2">Visitanos</h2>
            {config.direccion && <p className="text-sm font-semibold">{config.direccion}</p>}
            {config.horario && <p className="text-sm text-[var(--tinta-suave)] mt-1">{config.horario}</p>}
            {enlaceUbicacion && (
              <a
                href={enlaceUbicacion}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center h-11 px-5 rounded-full bg-[var(--verde)] text-white text-sm font-semibold"
              >
                📍 Cómo llegar
              </a>
            )}
          </section>
        )}

        {hayError && (
          <p className="my-6 text-center text-sm text-[var(--tinta-suave)]">
            No pudimos cargar los productos en este momento. Probá de nuevo en unos minutos.
          </p>
        )}

        {!esInicio && grupos.map((g) =>
          g.items.length === 0 ? null : (
            <section key={g.titulo} className="mt-6">
              <h2 className="text-lg font-bold text-[var(--verde)] mb-3">{g.titulo}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {g.items.map((item) => (
                  <Tarjeta key={item.id} item={item} carrito={carrito} abrir={() => setDetalle(item)} />
                ))}
              </div>
            </section>
          )
        )}
        {!hayError && !esInicio && visibles.length === 0 && (
          <p className="my-10 text-center text-[var(--tinta-suave)]">No encontramos productos con esa búsqueda.</p>
        )}

        {!esInicio && (
          <footer className="mt-12 mb-4 text-center text-xs text-[var(--tinta-suave)] space-y-1">
            {config.direccion && <p>Retiro en sucursal: {config.direccion}</p>}
            {config.horario && <p>{config.horario}</p>}
          </footer>
        )}
        {esInicio && <div className="h-6" />}
      </main>

      {cantidadLineas > 0 && !carritoAbierto && !detalle && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-white via-white/95 to-transparent">
          <button
            onClick={() => setCarritoAbierto(true)}
            className="max-w-5xl mx-auto w-full h-14 rounded-2xl bg-[var(--verde)] text-white flex items-center justify-between px-5 shadow-lg active:scale-[0.99]"
          >
            <span className="font-semibold">
              Ver pedido ({cantidadLineas} {cantidadLineas === 1 ? "producto" : "productos"})
            </span>
            <span className="font-bold">{money(total)}</span>
          </button>
        </div>
      )}

      {aviso && (
        <div className="fixed top-4 inset-x-0 z-[70] flex justify-center px-4 pointer-events-none">
          <div className="bg-[var(--tinta)] text-white text-sm font-medium rounded-full px-5 py-2.5 shadow-lg">{aviso}</div>
        </div>
      )}

      {detalle && (
        <Detalle
          item={detalle}
          porId={porId}
          carrito={carrito}
          cerrar={() => setDetalle(null)}
          onAgregar={(id, cantidad) => {
            agregar(id, cantidad);
            setDetalle(null);
            setAviso("Agregado al carrito ✓");
          }}
        />
      )}

      {carritoAbierto && (
        <Pedido
          lineas={lineas}
          total={total}
          config={config}
          agregar={agregar}
          quitar={quitar}
          vaciar={() => setCarrito({})}
          cerrar={() => setCarritoAbierto(false)}
        />
      )}
    </div>
  );
}

function CirculoCategoria({ nombre, foto, activo, onClick, todos }) {
  const ref = useRef(null);
  useEffect(() => {
    if (activo && ref.current) ref.current.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activo]);
  return (
    <button ref={ref} onClick={onClick} className="shrink-0 w-[72px] flex flex-col items-center gap-1.5">
      <span
        className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold border-2 transition-colors ${
          activo ? "border-[var(--verde)]" : "border-transparent"
        } ${foto ? "bg-[var(--fondo-suave)]" : "bg-[var(--verde-claro)] text-[var(--verde)]"}`}
      >
        {foto ? <img src={foto} alt="" loading="lazy" className="w-full h-full object-cover" /> : todos ? "★" : nombre.charAt(0).toUpperCase()}
      </span>
      <span className={`text-[11px] leading-tight text-center line-clamp-2 ${activo ? "font-bold text-[var(--verde)]" : "font-medium"}`}>{nombre}</span>
    </button>
  );
}

function Banners({ banners, nombre, bienvenida, sinBienvenida }) {
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
    if (sinBienvenida) return null;
    return (
      <div className="mt-4 rounded-2xl bg-[var(--verde-claro)] px-5 py-7 text-center">
        <p className="text-xl font-bold text-[var(--verde)]">Bienvenido a {nombre}</p>
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
            <div key={b.id} className="snap-center shrink-0 w-full aspect-[12/5] bg-[var(--fondo-suave)]">
              {b.enlace ? (
                <a
                  href={normalizarEnlace(b.enlace)}
                  target={esExterno(b.enlace) ? "_blank" : undefined}
                  rel={esExterno(b.enlace) ? "noopener noreferrer" : undefined}
                  className="block w-full h-full"
                >
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
            <span key={b.id} className={`h-1.5 rounded-full transition-all ${idx === actual ? "w-4 bg-[var(--verde)]" : "w-1.5 bg-[var(--borde)]"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ item, carrito, abrir }) {
  const tieneTramos = (item.tramos || []).length > 0;
  const opciones = item.tipo === "variantes" ? item.variantes : [item];
  const enCarrito = opciones.some((o) => carrito[o.id] > 0);

  let precioTexto = "";
  if (item.tipo === "variantes") precioTexto = "Desde " + money(Math.min(...item.variantes.map((v) => v.precio_venta)));
  else if (item.tipo === "peso") precioTexto = por100(item.precio_venta);
  else precioTexto = money(item.precio_venta);

  return (
    <button
      onClick={item.hayStock ? abrir : undefined}
      disabled={!item.hayStock}
      className={`text-left bg-white rounded-2xl border border-[var(--borde)] shadow-sm overflow-hidden flex flex-col active:scale-[0.99] transition-transform ${item.hayStock ? "" : "opacity-60"}`}
    >
      <div className="aspect-square bg-[var(--fondo-suave)] relative">
        {item.foto_url ? (
          <img src={item.foto_url} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🌰</div>
        )}
        {!item.hayStock && <span className="absolute top-2 left-2 text-[11px] font-semibold bg-[var(--tinta)] text-white px-2 py-1 rounded-full">Agotado</span>}
        {item.hayStock && tieneTramos && (
          <span className="absolute top-2 left-2 text-[11px] font-semibold bg-[var(--amarillo)] text-[var(--tinta)] px-2 py-1 rounded-full">Precio por cantidad</span>
        )}
        {enCarrito && (
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--verde)] text-white text-xs flex items-center justify-center">✓</span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        {item.categoria && <p className="text-[11px] font-medium text-[var(--tinta-suave)] uppercase tracking-wide truncate">{item.categoria}</p>}
        <p className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">{item.nombre}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[var(--verde)] font-bold">{precioTexto}</p>
          {item.hayStock && (
            <span className="w-9 h-9 rounded-full bg-[var(--verde-claro)] text-[var(--verde)] text-xl font-semibold flex items-center justify-center">+</span>
          )}
        </div>
      </div>
    </button>
  );
}

function Contador({ valor, etiqueta, onMenos, onMas, deshabilitarMenos, deshabilitarMas }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--borde)] bg-white h-14">
      <button
        onClick={onMenos}
        disabled={deshabilitarMenos}
        className="w-14 h-14 text-2xl font-semibold text-[var(--verde)] disabled:opacity-30"
        aria-label="Quitar"
      >
        −
      </button>
      <span className="text-lg font-bold">{etiqueta || valor}</span>
      <button
        onClick={onMas}
        disabled={deshabilitarMas}
        className="w-14 h-14 text-2xl font-semibold text-[var(--verde)] disabled:opacity-30"
        aria-label="Agregar"
      >
        +
      </button>
    </div>
  );
}

function Detalle({ item, porId, carrito, cerrar, onAgregar }) {
  const opciones = item.tipo === "variantes" ? item.variantes.filter((v) => disponible(v) > 0) : [item];
  const [opcionId, setOpcionId] = useState(opciones[0]?.id);
  const opcion = porId[opcionId] || item;
  const esPeso = opcion.unidad === "kg";
  const paso = pasoDe(opcion);
  const max = disponible(opcion);
  const yaEnCarrito = carrito[opcion.id] || 0;
  const inicial = esPeso ? Math.min(Math.max(paso, 0.1 - ((0.1 % paso) || 0)), max) : 1;
  const [cant, setCant] = useState(inicial);

  function elegirOpcion(id) {
    setOpcionId(id);
    const o = porId[id];
    setCant(o?.unidad === "kg" ? Math.min(Math.max(pasoDe(o), 0.1 - ((0.1 % pasoDe(o)) || 0)), disponible(o)) : 1);
  }

  // El precio por cantidad cuenta lo que ya hay en el carrito + lo que se está agregando.
  const precio = precioPorCantidad(opcion, redondear(yaEnCarrito + cant));
  const subtotal = precio * cant;
  const tramos = [...(opcion.tramos || [])].sort((a, b) => a.desde - b.desde);
  const unidadPrecio = esPeso ? " /100 g" : "";
  const mostrar = (p) => (esPeso ? money(p / 10) : money(p));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={cerrar}>
      <div className="bg-white w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[4/3] bg-[var(--fondo-suave)]">
          {item.foto_url ? (
            <img src={item.foto_url} alt={item.nombre} decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🌰</div>
          )}
          <button onClick={cerrar} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 text-lg shadow" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="p-5">
          {item.categoria && <p className="text-xs font-medium text-[var(--tinta-suave)] uppercase tracking-wide">{item.categoria}</p>}
          <h2 className="text-xl font-bold leading-snug mt-0.5">{item.nombre}</h2>

          {item.tipo === "variantes" && (
            <div className="flex flex-wrap gap-2 mt-3">
              {opciones.map((v) => {
                const etiqueta = Number(v.cantidad_por_unidad) > 0 ? formatoCantidad(Number(v.cantidad_por_unidad), "kg") : v.nombre;
                const activo = v.id === opcionId;
                return (
                  <button
                    key={v.id}
                    onClick={() => elegirOpcion(v.id)}
                    className={`h-11 px-4 rounded-xl text-sm font-semibold border ${activo ? "bg-[var(--verde)] text-white border-[var(--verde)]" : "bg-white border-[var(--borde)]"}`}
                  >
                    {etiqueta} · {money(precioPorCantidad(v, 1))}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-2xl font-extrabold text-[var(--verde)] mt-4">
            {mostrar(precio)}
            <span className="text-sm font-semibold text-[var(--tinta-suave)]">{unidadPrecio}</span>
          </p>
          {tramos.length > 0 && (
            <p className="text-xs text-[var(--tinta-suave)] mt-1">
              Llevando más, baja el precio:{" "}
              {tramos.map((t) => `desde ${formatoCantidad(Number(t.desde), esPeso ? "kg" : "un")} ${mostrar(t.precio)}${unidadPrecio}`).join(" · ")}
            </p>
          )}

          <div className="mt-4">
            <p className="text-sm font-semibold mb-2">
              {esPeso ? "¿Cuánto querés llevar?" : "Cantidad"}
              {esPeso && paso > PASO_KG + 1e-9 && <span className="font-normal text-[var(--tinta-suave)]"> · se vende {textoPaso(paso)}</span>}
            </p>
            <Contador
              etiqueta={esPeso ? formatoCantidad(cant, "kg") : String(cant)}
              onMenos={() => setCant((c) => Math.max(redondear(c - paso), paso))}
              onMas={() => setCant((c) => Math.min(redondear(c + paso), max))}
              deshabilitarMenos={cant <= paso + 1e-9}
              deshabilitarMas={cant + paso > max + 1e-9}
            />
            {esPeso && (
              <div className="flex gap-2 mt-2">
                {ATAJOS_KG.filter((m) => m <= max + 1e-9 && m >= paso - 1e-9 && Math.abs(m / paso - Math.round(m / paso)) < 1e-6).map((m) => (
                  <button
                    key={m}
                    onClick={() => setCant(m)}
                    className={`flex-1 h-10 rounded-xl text-sm font-semibold border ${Math.abs(cant - m) < 1e-6 ? "bg-[var(--verde-claro)] border-[var(--verde)] text-[var(--verde)]" : "bg-white border-[var(--borde)]"}`}
                  >
                    {formatoCantidad(m, "kg")}
                  </button>
                ))}
              </div>
            )}
            {cant + paso > max + 1e-9 && <p className="text-xs text-[var(--tinta-suave)] mt-2">Es el máximo disponible por ahora.</p>}
            {yaEnCarrito > 0 && (
              <p className="text-xs text-[var(--verde)] font-medium mt-2">
                Ya tenés {esPeso ? formatoCantidad(yaEnCarrito, "kg") : `${yaEnCarrito} un.`} en tu pedido.
              </p>
            )}
          </div>

          <button
            onClick={() => onAgregar(opcion.id, cant)}
            disabled={max <= 0}
            className="mt-5 w-full h-14 rounded-2xl bg-[var(--verde)] hover:bg-[var(--verde-oscuro)] text-white font-bold flex items-center justify-between px-5 active:scale-[0.99] disabled:opacity-50"
          >
            <span>Agregar al carrito</span>
            <span>{money(subtotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Pedido({ lineas, total, config, agregar, quitar, vaciar, cerrar }) {
  const [entrega, setEntrega] = useState("retiro");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [pago, setPago] = useState("Efectivo");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);
  const [punto, setPunto] = useState(null); // ubicación marcada en el mapa
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(null);

  // Los datos del cliente se recuerdan en este celular para la próxima compra.
  useEffect(() => {
    try {
      const d = JSON.parse(window.localStorage.getItem("nuezco_cliente_v1") || "{}");
      if (d.nombre) setNombre(d.nombre);
      if (d.direccion) setDireccion(d.direccion);
      if (d.telefono) setTelefono(d.telefono);
      if (d.punto && typeof d.punto.lat === "number" && typeof d.punto.lng === "number") setPunto(d.punto);
    } catch (e) {
      // sin datos guardados
    }
  }, []);

  const gratis = config.envioGratisDesde > 0 && total >= config.envioGratisDesde;
  const faltaParaGratis = config.envioGratisDesde > 0 ? Math.max(config.envioGratisDesde - total, 0) : 0;
  const progreso = config.envioGratisDesde > 0 ? Math.min(total / config.envioGratisDesde, 1) : 0;

  const hayMapa = !!config.sucursal;
  const calculo = entrega === "envio" ? costoEnvio(config.zonasEnvio, config.sucursal, punto) : null;
  const costoFinal = entrega === "envio" && !gratis && calculo && !calculo.fuera ? calculo.precio : 0;
  const totalFinal = total + costoFinal;

  async function enviar() {
    if (enviando) return;
    setError("");
    if (lineas.length === 0) return setError("Tu pedido está vacío.");
    if (!nombre.trim()) return setError("Escribí tu nombre.");
    if (telefono.replace(/\D/g, "").length < 8) return setError("Escribí tu número de WhatsApp para poder avisarte.");
    if (entrega === "envio" && !direccion.trim()) return setError("Escribí la dirección de entrega.");
    if (entrega === "envio" && hayMapa && !punto) return setError("Marcá tu ubicación en el mapa para calcular el envío.");
    if (!config.whatsapp) return setError("La tienda todavía no tiene un WhatsApp configurado.");

    try {
      window.localStorage.setItem("nuezco_cliente_v1", JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), direccion: direccion.trim(), punto }));
    } catch (e) {
      // no es importante
    }

    const detalle = lineas.map((l) => {
      const cant = l.row.unidad === "kg" ? `${formatoCantidad(l.cantidad, "kg")} de ${l.row.nombre}` : `${l.cantidad} × ${l.row.nombre}`;
      return `• ${cant} — ${money(l.subtotal)}`;
    });

    let lineaEntrega = "Entrega: Retiro en sucursal";
    if (entrega === "envio") {
      let costoTexto = "costo a coordinar con la cadetería";
      if (gratis) costoTexto = "envío gratis";
      else if (calculo && !calculo.fuera) costoTexto = `envío ${money(calculo.precio)}`;
      else if (calculo && calculo.fuera) costoTexto = "fuera de la zona de envío, a coordinar";
      lineaEntrega = `Entrega: Envío a domicilio (${direccion.trim()}) — ${costoTexto}`;
      if (punto) lineaEntrega += `\nUbicación: ${enlaceMapa(punto)}`;
    }

    // Guardamos el pedido en el sistema de la tienda. Si falla (sin señal, etc.), igual seguimos por WhatsApp.
    setEnviando(true);
    let numeroPedido = null;
    try {
      const guardar = supabase.rpc("crear_pedido_online", {
        p: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          entrega,
          direccion: entrega === "envio" ? direccion.trim() : "",
          lat: entrega === "envio" && punto ? punto.lat : null,
          lng: entrega === "envio" && punto ? punto.lng : null,
          costo_envio: costoFinal,
          envio_gratis: entrega === "envio" && gratis,
          fuera_de_zona: !!(calculo && calculo.fuera),
          medio_pago: pago,
          notas: notas.trim(),
          total_productos: total,
          items: lineas.map((l) => ({
            producto_id: l.id,
            nombre: l.row.nombre,
            unidad: l.row.unidad,
            cantidad: l.cantidad,
            precio_unitario: l.precio,
            subtotal: l.subtotal,
          })),
        },
      });
      const { data, error: errPedido } = await Promise.race([guardar, new Promise((res) => setTimeout(() => res({ data: null, error: "tiempo" }), 6000))]);
      if (!errPedido && data) numeroPedido = data;
    } catch (e) {
      // seguimos sin número de pedido
    }
    setEnviando(false);

    const texto = [
      `Hola ${config.nombre}! Quiero hacer este pedido${numeroPedido ? ` (Pedido #${numeroPedido})` : ""}:`,
      "",
      ...detalle,
      "",
      `Total de productos: ${money(total)}`,
      lineaEntrega,
      costoFinal > 0 ? `Total con envío: ${money(totalFinal)}` : null,
      `Medio de pago: ${pago}`,
      `Nombre: ${nombre.trim()}`,
      `Teléfono: ${telefono.trim()}`,
      notas.trim() ? `Notas: ${notas.trim()}` : null,
    ]
      .filter((x) => x !== null)
      .join("\n");

    const urlWhatsApp = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(texto)}`;
    // Pedido enviado: se vacía el carrito y se muestra la confirmación, para que nadie lo repita por error.
    setPedidoEnviado({ numero: numeroPedido, url: urlWhatsApp });
    vaciar();
    setTimeout(() => {
      window.location.href = urlWhatsApp;
    }, 600);
  }

  if (pedidoEnviado) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl px-6 py-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[var(--verde-claro)] text-[var(--verde)] flex items-center justify-center text-3xl mb-4">✓</div>
          <h2 className="text-2xl font-extrabold text-[var(--verde)]">¡Pedido enviado!</h2>
          {pedidoEnviado.numero && <p className="text-sm font-semibold mt-1">Pedido #{pedidoEnviado.numero}</p>}
          <p className="text-sm text-[var(--tinta-suave)] mt-3">
            Recibimos tu pedido. Te confirmamos por WhatsApp el stock, el total y la entrega. ¡Gracias por elegirnos!
          </p>
          <a href={pedidoEnviado.url} className="mt-5 block w-full h-12 leading-[3rem] rounded-xl border border-[var(--borde)] text-sm font-semibold">
            Si no se abrió WhatsApp, tocá acá
          </a>
          <button onClick={cerrar} className="mt-3 w-full h-14 rounded-2xl bg-[var(--verde)] text-white font-bold">
            Seguir comprando
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={cerrar}>
      <div className="bg-white w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--borde)] z-10">
          <h2 className="text-xl font-bold text-[var(--verde)]">Tu pedido</h2>
          <button onClick={cerrar} className="w-10 h-10 text-xl text-[var(--tinta-suave)]" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {config.envioGratisDesde > 0 && lineas.length > 0 && (
          <div className="px-5 pt-4">
            <p className={`text-xs font-semibold mb-1.5 ${gratis ? "text-[var(--verde)]" : "text-[var(--tinta-suave)]"}`}>
              {gratis ? "¡Tenés envío gratis!" : `Te faltan ${money(faltaParaGratis)} para envío gratis`}
            </p>
            <div className="h-2 rounded-full bg-[var(--fondo-suave)] overflow-hidden">
              <div className="h-full bg-[var(--verde)] rounded-full transition-all" style={{ width: `${progreso * 100}%` }} />
            </div>
          </div>
        )}

        <div className="px-5 py-3">
          {lineas.length === 0 && <p className="py-6 text-center text-[var(--tinta-suave)]">Todavía no agregaste productos.</p>}
          {lineas.map((l) => {
            const esKg = l.row.unidad === "kg";
            const paso = pasoDe(l.row);
            return (
              <div key={l.id} className="flex items-center gap-3 py-3 border-b border-[var(--borde)] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug">{l.row.nombre}</p>
                  <p className="text-xs text-[var(--tinta-suave)] mt-0.5">
                    {esKg ? formatoCantidad(l.cantidad, "kg") : `${l.cantidad} un.`} · {esKg ? por100(l.precio) : money(l.precio) + " c/u"}
                  </p>
                </div>
                <div className="flex items-center rounded-xl border border-[var(--borde)]">
                  <button
                    className="w-10 h-10 text-lg text-[var(--verde)]"
                    onClick={() => (l.cantidad - paso <= 0.0001 ? quitar(l.id) : agregar(l.id, -paso))}
                    aria-label="Quitar"
                  >
                    −
                  </button>
                  <button className="w-10 h-10 text-lg text-[var(--verde)]" onClick={() => agregar(l.id, paso)} aria-label="Agregar">
                    +
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-bold">{money(l.subtotal)}</p>
              </div>
            );
          })}
          {lineas.length > 0 && (
            confirmandoVaciar ? (
              <div className="mt-3 rounded-2xl bg-[var(--fondo-suave)] p-4">
                <p className="text-sm font-semibold mb-3">¿Vaciar todo el pedido?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmandoVaciar(false)} className="flex-1 h-11 rounded-xl border border-[var(--borde)] bg-white text-sm font-semibold">
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setConfirmandoVaciar(false);
                      vaciar();
                    }}
                    className="flex-1 h-11 rounded-xl bg-[var(--verde)] text-white text-sm font-semibold"
                  >
                    Sí, vaciar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmandoVaciar(true)} className="text-xs text-[var(--tinta-suave)] underline mt-2">
                Vaciar pedido
              </button>
            )
          )}
        </div>

        {lineas.length > 0 && (
          <div className="px-5 pb-6">
            <p className="text-sm font-semibold mb-2">¿Cómo lo recibís?</p>
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
                  className="w-full h-12 px-4 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--verde)] text-base"
                />
                {hayMapa && (
                  <button
                    onClick={() => setMapaAbierto(true)}
                    className={`mt-2 w-full h-12 rounded-xl border text-sm font-semibold ${punto ? "border-[var(--verde)] bg-[var(--verde-claro)] text-[var(--verde)]" : "border-[var(--borde)] bg-white"}`}
                  >
                    {punto ? "📍 Ubicación marcada · Cambiar" : "📍 Marcar mi ubicación en el mapa"}
                  </button>
                )}
                <p className={`text-xs mt-1.5 ${gratis || (calculo && !calculo.fuera) ? "text-[var(--verde)] font-semibold" : "text-[var(--tinta-suave)]"}`}>
                  {gratis
                    ? "¡Tu envío es gratis!"
                    : calculo && !calculo.fuera
                    ? `Envío a ${calculo.km.toFixed(1).replace(".", ",")} km: ${money(calculo.precio)}`
                    : calculo && calculo.fuera
                    ? "Tu ubicación queda fuera de nuestra zona de envío. Enviá el pedido y lo coordinamos por WhatsApp."
                    : "Costo de envío a coordinar con la cadetería."}
                </p>
              </div>
            )}

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full h-12 px-4 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--verde)] text-base mb-2"
            />
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Tu WhatsApp (ej: 3584123456)"
              inputMode="tel"
              className="w-full h-12 px-4 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--verde)] text-base mb-2"
            />
            <select
              value={pago}
              onChange={(e) => setPago(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-[var(--borde)] bg-white outline-none text-base mb-2"
            >
              <option>Efectivo</option>
              <option>Transferencia</option>
            </select>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--verde)] text-base"
            />

            <div className="flex items-center justify-between mt-4 mb-3">
              <span className="text-sm text-[var(--tinta-suave)]">Total de productos</span>
              <span className="text-xl font-extrabold">{money(total)}</span>
            </div>
            {costoFinal > 0 && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--tinta-suave)]">Envío</span>
                  <span className="font-bold">{money(costoFinal)}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Total con envío</span>
                  <span className="text-xl font-extrabold text-[var(--verde)]">{money(totalFinal)}</span>
                </div>
              </>
            )}
            {mapaAbierto && (
              <MapaEnvio
                sucursal={config.sucursal}
                zonas={config.zonasEnvio}
                inicial={punto}
                onCerrar={() => setMapaAbierto(false)}
                onConfirmar={(p) => {
                  setPunto(p);
                  setMapaAbierto(false);
                }}
              />
            )}
            {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
            <button onClick={enviar} disabled={enviando} className="w-full h-14 rounded-2xl bg-[#1fa855] hover:bg-[#188c46] disabled:opacity-60 text-white font-bold text-base active:scale-[0.99]">
              {enviando ? "Enviando..." : "Enviar pedido por WhatsApp"}
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
      className={`h-12 rounded-xl text-sm font-semibold border ${activo ? "bg-[var(--verde)] text-white border-[var(--verde)]" : "bg-white border-[var(--borde)]"}`}
    >
      {children}
    </button>
  );
}
