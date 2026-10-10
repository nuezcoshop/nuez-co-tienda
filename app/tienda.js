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
// Dominios propios de la tienda: un enlace a cualquiera de ellos (con o sin www) se considera "interno".
const DOMINIOS_PROPIOS = ["nuezco.com.ar", "nuezco.shop"];
const sinWww = (h) => String(h || "").toLowerCase().replace(/^www\./, "");
function urlInterna(url) {
  const u = normalizarEnlace(url);
  if (u.startsWith("/") || u.startsWith("#")) return new URL(u, window.location.origin);
  if (!/^https?:/i.test(u)) return null;
  try {
    const x = new URL(u);
    const h = sinWww(x.host);
    if (h === sinWww(window.location.host) || DOMINIOS_PROPIOS.includes(h)) return x;
  } catch (e) {
    // enlace raro: se trata como externo
  }
  return null;
}
function esExterno(url) {
  return /^https?:/i.test(normalizarEnlace(url)) && !urlInterna(url);
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

function IconoMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-7 h-7">
      <path d="M4 7h16M4 12h16M4 17h16" />
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
  const [vista, setVista] = useState("inicio"); // "inicio" o "tienda"
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Enlaces directos (por ejemplo desde un banner): ?categoria=Granolas, ?buscar=yerba o ?producto=12
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const cat = sp.get("categoria");
      const bus = sp.get("buscar");
      const prod = sp.get("producto");
      if (cat) {
        setCategoria(cat);
        setVista("tienda");
      }
      if (bus) {
        setBusqueda(bus);
        setVista("tienda");
      }
      if (prod) {
        const it = items.find((i) => String(i.id) === prod || (i.variantes || []).some((v) => String(v.id) === prod));
        if (it) setDetalle(it);
      }
    } catch (e) {
      // sin parámetros
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantiene la dirección del navegador al día (?categoria=…, ?producto=…, ?buscar=…) para poder copiar y compartir el link.
  // Usa replaceState: no recarga ni agrega pasos al historial. La primera pasada se saltea para no borrar el link con el que se entró.
  const urlInicial = useRef(true);
  useEffect(() => {
    if (urlInicial.current) {
      urlInicial.current = false;
      return;
    }
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("categoria");
      u.searchParams.delete("buscar");
      u.searchParams.delete("producto");
      if (categoria && categoria !== TODOS) u.searchParams.set("categoria", categoria);
      if (busqueda.trim()) u.searchParams.set("buscar", busqueda.trim());
      if (detalle && detalle.id !== undefined) u.searchParams.set("producto", String(detalle.id));
      const nuevo = u.pathname + (u.search || "") + u.hash;
      if (nuevo !== window.location.pathname + window.location.search + window.location.hash) {
        window.history.replaceState(null, "", nuevo);
      }
    } catch (e) {
      // si el navegador no lo permite, la tienda sigue funcionando igual
    }
  }, [categoria, busqueda, detalle]);

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
    document.body.style.overflow = carritoAbierto || detalle || menuAbierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [carritoAbierto, detalle, menuAbierto]);

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

  // Orden de categorías: primero las que se eligieron en el sistema (en ese orden), después el resto de la A a la Z.
  const ordenElegido = config.categoriasOrden || [];
  function compararCategorias(a, b) {
    const ia = ordenElegido.indexOf(a);
    const ib = ordenElegido.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  }

  const categorias = useMemo(() => {
    const set = new Set();
    items.forEach((i) => i.categoria && set.add(i.categoria));
    return [...set].sort(compararCategorias);
  }, [items, config.categoriasOrden]);

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
  const esInicio = vista === "inicio";
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
    setMenuAbierto(false);
    setVista("inicio");
    window.scrollTo({ top: 0 });
  }

  // Enlaces de banners que apuntan a la propia tienda: se resuelven acá, sin recargar y sin importar el dominio.
  function abrirEnlace(e, url) {
    let x = null;
    try {
      x = urlInterna(url);
    } catch (err) {
      x = null;
    }
    if (!x) return; // externo: el enlace normal se abre en otra pestaña
    const cat = x.searchParams.get("categoria");
    const bus = x.searchParams.get("buscar");
    const prod = x.searchParams.get("producto");
    const esHome = /^\/?$/.test(x.pathname);
    if (!cat && !bus && !prod && !esHome) return; // otra página: se abre normal
    e.preventDefault();
    if (cat || bus) {
      setCategoria(cat || "");
      setBusqueda(bus || "");
      setVista("tienda");
      window.scrollTo({ top: 0 });
    } else if (!prod) {
      irAInicio();
    }
    if (prod) {
      const it = items.find((i) => String(i.id) === prod || (i.variantes || []).some((v) => String(v.id) === prod));
      if (it) setDetalle(it);
    }
  }

  function irATienda() {
    setCategoria("");
    setBusqueda("");
    setMenuAbierto(false);
    setVista("tienda");
    window.scrollTo({ top: 0 });
  }

  const enlaceInstagram = config.instagram
    ? /^https?:\/\//i.test(config.instagram.trim())
      ? config.instagram.trim()
      : `https://instagram.com/${config.instagram.trim().replace(/^@/, "").replace(/^(www\.)?instagram\.com\//i, "")}`
    : "";
  const enlaceContacto = config.whatsapp ? `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(`Hola ${config.nombre}! Quería hacerles una consulta.`)}` : "";

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
      .sort(([a], [b]) => (a === "Otros" ? 1 : b === "Otros" ? -1 : compararCategorias(a, b)))
      .map(([titulo, its]) => ({ titulo, items: its }));
  }

  return (
    <div className="min-h-screen pb-28 bg-[var(--fondo)]">
      {(config.envioGratisDesde > 0 || config.direccion) && (
        <div className="bg-[var(--verde)] text-white text-xs font-medium py-2 overflow-hidden whitespace-nowrap">
          <div className="cinta-pista">
            {[0, 1].map((k) => (
              <div key={k} className="cinta-grupo" aria-hidden={k === 1 ? "true" : undefined}>
                {[0, 1, 2, 3].map((n) => (
                  <span key={n} className="px-6">
                    {config.envioGratisDesde > 0 ? `Envío gratis en compras desde ${money(config.envioGratisDesde)}` : `Retiro en sucursal: ${config.direccion}`}
                    <span className="mx-6 opacity-60">•</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-[44px_1fr_44px] items-center py-3">
          <button
            onClick={() => setMenuAbierto(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--verde)]"
            aria-label="Abrir menú"
          >
            <IconoMenu />
          </button>
          <button onClick={irAInicio} aria-label="Ir al inicio" className="justify-self-center">
            {config.logo ? (
              <img src={config.logo} alt={config.nombre} className="h-11 w-auto max-w-[200px] object-contain" />
            ) : (
              <h1 className="text-2xl font-extrabold text-[var(--verde)] tracking-tight">{config.nombre}</h1>
            )}
          </button>
          <button
            onClick={() => setCarritoAbierto(true)}
            className="relative w-11 h-11 rounded-full text-[var(--verde)] flex items-center justify-center justify-self-end"
            aria-label="Ver pedido"
          >
            <IconoCarrito className="w-7 h-7" />
            {cantidadLineas > 0 && (
              <span key={cantidadLineas} className="salto absolute top-0 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[var(--acento)] text-[var(--sobre-acento)] text-xs font-bold flex items-center justify-center">
                {cantidadLineas}
              </span>
            )}
          </button>
        </div>
      </div>

      {!esInicio && (
      <div className="sticky top-0 z-30 bg-[var(--fondo)]">
        <div className="max-w-5xl mx-auto px-4 pt-2 pb-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--verde)]">
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
              className="w-full h-12 pl-12 pr-4 rounded-full bg-transparent border-2 border-[var(--verde)] text-[var(--verde)] font-semibold placeholder:text-[var(--verde)] placeholder:opacity-70 placeholder:font-medium outline-none text-base"
            />
          </div>
        </div>
      </div>
      )}

      <main className="max-w-5xl mx-auto px-4">
        {!esInicio && categorias.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto sin-barra mt-3 -mx-4 px-4 pb-1">
            <CirculoCategoria nombre="Todos" activo={!categoria || categoria === TODOS} onClick={() => setCategoria(TODOS)} />
            {categorias.map((c) => (
              <CirculoCategoria key={c} nombre={c} activo={categoria === c} onClick={() => setCategoria(c)} />
            ))}
          </div>
        )}

        {esInicio && <Banners banners={bannersPrincipal} nombre={config.nombre} bienvenida={config.bienvenida} grande onEnlace={abrirEnlace} />}

        {esInicio && productosDestacados.length > 0 && (
          <section className="mt-6 rev">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold text-[var(--verde)]">{config.destacadosTitulo}</h2>
              <button onClick={irATienda} className="shrink-0 h-9 px-4 rounded-full border-2 border-[var(--verde)] bg-[var(--acento)] text-[var(--sobre-acento)] text-sm font-semibold active:scale-[0.93] transition-transform">
                Ir a la tienda →
              </button>
            </div>
            <CarruselFavoritos items={productosDestacados} carrito={carrito} abrir={(item) => setDetalle(item)} />
          </section>
        )}

        {esInicio && productosDestacados.length === 0 && (
          <div className="mt-6 text-center">
            <button onClick={irATienda} className="h-12 px-8 rounded-full border-2 border-[var(--verde)] bg-[var(--acento)] text-[var(--sobre-acento)] font-semibold">
              Ir a la tienda →
            </button>
          </div>
        )}

        {esInicio && bannersInicio.length > 0 && <div className="rev"><Banners banners={bannersInicio} sinBienvenida onEnlace={abrirEnlace} /></div>}

        {esInicio && config.nosotros && config.nosotros.activo && (config.nosotros.texto || config.nosotros.foto || config.nosotros.subtitulo) && (
          <Nosotros datos={config.nosotros} />
        )}

        {esInicio && (config.direccion || enlaceUbicacion || enlaceContacto || enlaceInstagram) && (
          <section className="mt-10 text-center text-[var(--verde)] rev">
            <h2 className="text-xl font-extrabold">Visitá nuestra tienda</h2>
            {config.direccion && <p className="text-base font-semibold mt-1">{config.direccion}</p>}
            {enlaceUbicacion && (
              <a
                href={enlaceUbicacion}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-full border-2 border-[var(--verde)] bg-[var(--acento)] text-[var(--sobre-acento)] text-sm font-semibold active:scale-[0.93] transition-transform"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Cómo llegar
              </a>
            )}
            {(enlaceInstagram || enlaceContacto) && (
              <div className="mt-5 flex items-center justify-center gap-5">
                {enlaceInstagram && (
                  <a href={enlaceInstagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="active:scale-90 transition-transform">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="2" width="20" height="20" rx="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </a>
                )}
                {enlaceContacto && (
                  <a href={enlaceContacto} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="active:scale-90 transition-transform">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
                    </svg>
                  </a>
                )}
              </div>
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
                {g.items.map((item, i) => (
                  <div key={item.id} className="casc flex" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                    <Tarjeta item={item} carrito={carrito} abrir={() => setDetalle(item)} />
                  </div>
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
        <div className="logo-final mt-12 mb-8 flex flex-col items-center text-center">
          {config.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo} alt={config.nombre} className="h-36 w-auto max-w-[85%] object-contain" />
          ) : (
            <span className="text-5xl font-extrabold text-[var(--verde)]">{config.nombre}</span>
          )}
          <span className="mt-3 text-sm font-semibold tracking-[0.1em] text-[var(--verde)]">© {new Date().getFullYear()} Nuez Co</span>
        </div>
      </main>

      {cantidadLineas > 0 && !carritoAbierto && !detalle && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-[var(--fondo)] via-[var(--fondo)] to-transparent">
          <button
            onClick={() => setCarritoAbierto(true)}
            className="max-w-5xl mx-auto w-full h-14 rounded-2xl bg-[var(--acento)] text-[var(--sobre-acento)] flex items-center justify-between px-5 shadow-lg active:scale-[0.99]"
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

      {menuAbierto && (
        <div className="fixed inset-0 z-[55]" onClick={() => setMenuAbierto(false)}>
          <div className="absolute inset-0 bg-black/40 fundir" />
          <nav className="deslizar-izq absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-[var(--fondo)] shadow-xl p-5 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              {config.logo ? <img src={config.logo} alt={config.nombre} className="h-9 w-auto max-w-[160px] object-contain" /> : <span className="text-xl font-extrabold text-[var(--verde)]">{config.nombre}</span>}
              <button onClick={() => setMenuAbierto(false)} className="w-10 h-10 rounded-full text-lg text-[var(--verde)]" aria-label="Cerrar menú">
                ✕
              </button>
            </div>
            <button onClick={irAInicio} className="text-left text-lg font-semibold py-4 linea-menu text-[var(--verde)]">
              Inicio
            </button>
            <button onClick={irATienda} className="text-left text-lg font-semibold py-4 linea-menu text-[var(--verde)]">
              Productos
            </button>
            {enlaceContacto ? (
              <a href={enlaceContacto} target="_blank" rel="noopener noreferrer" onClick={() => setMenuAbierto(false)} className="text-lg font-semibold py-4 linea-menu text-[var(--verde)]">
                Contactanos por WhatsApp
              </a>
            ) : (
              <span className="text-lg font-semibold py-4 linea-menu text-[var(--verde)] opacity-50">Contactanos por WhatsApp</span>
            )}
          </nav>
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

function Nosotros({ datos }) {
  const [abierto, setAbierto] = useState(false);
  const largo = (datos.texto || "").length > 140 || (datos.texto || "").includes("\n");
  return (
    <section className="mt-6 rev">
      <h2 className="text-lg font-bold text-[var(--verde)] mb-3">{datos.titulo}</h2>
      <div className="rounded-2xl overflow-hidden bg-[var(--fondo-suave)]">
        {datos.foto && (
          <div className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={datos.foto} alt={datos.subtitulo || datos.titulo} loading="lazy" decoding="async" className="zoom-lento w-full max-h-80 object-cover" />
          </div>
        )}
        <div className="p-5 text-[var(--verde)] rev">
          {datos.subtitulo && <h3 className="text-xl font-extrabold leading-snug">{datos.subtitulo}</h3>}
          {datos.texto && (
            <p className={`text-sm mt-2 leading-relaxed whitespace-pre-line opacity-90 ${abierto ? "" : "line-clamp-3"}`}>{datos.texto}</p>
          )}
          {datos.texto && largo && (
            <button onClick={() => setAbierto(!abierto)} className="mt-3 h-10 px-5 rounded-full border-2 border-[var(--verde)] text-sm font-semibold" aria-expanded={abierto}>
              {abierto ? "Leer menos" : "Leer más"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function CirculoCategoria({ nombre, activo, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (activo && ref.current) ref.current.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activo]);
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`shrink-0 h-11 px-5 rounded-full border-2 border-[var(--verde)] font-extrabold text-[15px] whitespace-nowrap transition-colors ${
        activo ? "bg-[var(--acento)] text-[var(--sobre-acento)]" : "bg-transparent text-[var(--verde)]"
      }`}
    >
      {nombre}
    </button>
  );
}

function Banners({ banners, nombre, bienvenida, sinBienvenida, grande, onEnlace }) {
  const contenedor = useRef(null);
  const [actual, setActual] = useState(0);
  const pausaHasta = useRef(0);

  useEffect(() => {
    if (!banners || banners.length < 2) return;
    const t = setInterval(() => {
      const el = contenedor.current;
      if (!el || Date.now() < pausaHasta.current) return;
      const siguiente = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length;
      el.scrollTo({ left: siguiente * el.clientWidth, behavior: "smooth" });
    }, 3000);
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
        onTouchStart={() => (pausaHasta.current = Date.now() + 6000)}
        className={`flex overflow-x-auto snap-x snap-mandatory sin-barra rounded-2xl ${grande ? "encoge" : ""}`}
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
            <div key={b.id} className={`snap-center shrink-0 w-full bg-[var(--fondo-suave)] ${grande ? "aspect-[4/5] md:aspect-[16/9]" : "aspect-[12/5]"}`}>
              {b.enlace ? (
                <a
                  href={normalizarEnlace(b.enlace)}
                  target={esExterno(b.enlace) ? "_blank" : undefined}
                  rel={esExterno(b.enlace) ? "noopener noreferrer" : undefined}
                  onClick={(e) => onEnlace && onEnlace(e, b.enlace)}
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

// Carrusel de favoritos "sin fin": el producto del medio se agranda, los de los costados se achican,
// avanza solo uno a uno y el último se conecta con el primero. Se frena si la persona lo toca.
function CarruselFavoritos({ items, carrito, abrir }) {
  const n = items.length;
  const veces = n >= 2 ? Math.ceil(7 / n) : 1; // con pocos productos se repiten para que el giro se vea continuo
  const lista = [];
  for (let k = 0; k < veces; k++) items.forEach((it) => lista.push(it));
  const m = lista.length;
  const [indice, setIndice] = useState(0);
  const pausaHasta = useRef(0);
  const inicioX = useRef(null);

  useEffect(() => {
    if (m < 2) return;
    // Avanza siempre (también con el ahorro de batería / "quitar animaciones" del celular): es un movimiento suave y corto.
    const t = setInterval(() => {
      if (document.hidden || Date.now() < pausaHasta.current) return;
      setIndice((i) => (i + 1) % m);
    }, 2500);
    return () => clearInterval(t);
  }, [m]);

  const frenar = () => (pausaHasta.current = Date.now() + 6000);
  const mover = (delta) => setIndice((i) => (i + delta + m) % m);

  if (m === 1) {
    return (
      <div className="flex justify-center">
        <div className="w-44 flex">
          <Tarjeta item={items[0]} carrito={carrito} abrir={() => abrir(items[0])} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative -mx-4 overflow-hidden py-5"
      onPointerEnter={(e) => e.pointerType === "mouse" && frenar()}
      onPointerMove={(e) => e.pointerType === "mouse" && frenar()}
      onTouchStart={(e) => {
        frenar();
        inicioX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (inicioX.current === null) return;
        const dx = e.changedTouches[0].clientX - inicioX.current;
        inicioX.current = null;
        if (Math.abs(dx) > 40) mover(dx < 0 ? 1 : -1);
      }}
      style={{ touchAction: "pan-y" }}
    >
      {/* copia invisible: da el alto al carrusel */}
      <div className="invisible w-40 mx-auto pointer-events-none" aria-hidden="true">
        <Tarjeta item={items[0]} carrito={carrito} abrir={() => {}} />
      </div>
      {lista.map((item, i) => {
        let d = (((i - indice) % m) + m) % m;
        if (d > m / 2) d -= m;
        const visible = Math.abs(d) <= 2;
        const centro = d === 0;
        return (
          <div
            key={i}
            className="absolute top-5 flex"
            style={{
              left: "50%",
              width: 160,
              marginLeft: -80,
              transform: `translateX(${d * 178}px) scale(${centro ? 1.08 : 0.82})`,
              opacity: visible ? (centro ? 1 : 0.85) : 0,
              zIndex: 10 - Math.abs(d),
              pointerEvents: visible ? "auto" : "none",
              transition: "transform 0.6s cubic-bezier(0.22, 0.8, 0.3, 1), opacity 0.45s ease",
              willChange: "transform, opacity",
            }}
          >
            <Tarjeta item={item} carrito={carrito} abrir={() => (centro ? abrir(item) : (frenar(), setIndice(i)))} />
          </div>
        );
      })}
    </div>
  );
}

function Tarjeta({ item, carrito, abrir }) {
  const tieneTramos = (item.tramos || []).length > 0;
  const opciones = item.tipo === "variantes" ? item.variantes : [item];
  const enCarrito = opciones.some((o) => carrito[o.id] > 0);
  const etiqueta = item.etiqueta || (opciones.find((o) => o.etiqueta) || {}).etiqueta;
  const abajo = etiqueta ? "top-10" : "top-2";

  let precioTexto = "";
  if (item.tipo === "variantes") precioTexto = "Desde " + money(Math.min(...item.variantes.map((v) => v.precio_venta)));
  else if (item.tipo === "peso") precioTexto = por100(item.precio_venta);
  else precioTexto = money(item.precio_venta);

  return (
    <button
      onClick={item.hayStock ? abrir : undefined}
      disabled={!item.hayStock}
      className={`text-left bg-transparent rounded-3xl border border-[var(--verde)] overflow-hidden flex flex-col w-full active:scale-[0.97] transition-transform ${item.hayStock ? "" : "opacity-60"}`}
    >
      <div className="aspect-square bg-white relative">
        {item.foto_url ? (
          <img src={item.foto_url} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🌰</div>
        )}
        {etiqueta && (
          <span className="absolute top-2 left-2 text-xs font-extrabold bg-[var(--verde)] text-[var(--fondo)] px-3 py-1 rounded-full">{etiqueta}</span>
        )}
        {!item.hayStock && <span className={`absolute ${abajo} left-2 text-[11px] font-semibold bg-[var(--tinta)] text-white px-2 py-1 rounded-full`}>Agotado</span>}
        {item.hayStock && tieneTramos && (
          <span className={`absolute ${abajo} left-2 text-[11px] font-semibold bg-[var(--amarillo)] text-[var(--tinta)] px-2 py-1 rounded-full`}>Precio por cantidad</span>
        )}
        {enCarrito && (
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--acento)] text-[var(--sobre-acento)] text-xs flex items-center justify-center">✓</span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1 text-[var(--verde)] border-t border-[var(--verde)]">
        <p className="text-[15px] font-extrabold leading-snug line-clamp-2 min-h-[2.5rem]">{item.nombre}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="font-medium text-[15px]">{precioTexto}</p>
          {item.hayStock && (
            <span className="w-9 h-9 rounded-full bg-[var(--acento)] text-[var(--sobre-acento)] text-xl font-normal flex items-center justify-center">+</span>
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
    <div className="fundir fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={cerrar}>
      <div className="subir bg-white w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
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
          {(item.descripcion || (opciones.find((o) => o.descripcion) || {}).descripcion) && (
            <p className="text-sm text-[var(--tinta-suave)] mt-1.5 leading-snug">{item.descripcion || opciones.find((o) => o.descripcion).descripcion}</p>
          )}

          {item.tipo === "variantes" && (
            <div className="flex flex-wrap gap-2 mt-3">
              {opciones.map((v) => {
                const etiqueta = Number(v.cantidad_por_unidad) > 0 ? formatoCantidad(Number(v.cantidad_por_unidad), "kg") : v.nombre;
                const activo = v.id === opcionId;
                return (
                  <button
                    key={v.id}
                    onClick={() => elegirOpcion(v.id)}
                    className={`h-11 px-4 rounded-xl text-sm font-semibold border ${activo ? "bg-[var(--acento)] text-[var(--sobre-acento)] border-[var(--verde)]" : "bg-white border-[var(--borde)]"}`}
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
            className="mt-5 w-full h-14 rounded-2xl bg-[var(--acento)] hover:brightness-95 text-[var(--sobre-acento)] font-bold flex items-center justify-between px-5 active:scale-[0.99] disabled:opacity-50"
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
  const [cuponAbierto, setCuponAbierto] = useState(false);
  const [cuponCodigo, setCuponCodigo] = useState("");
  const [cupon, setCupon] = useState(null); // cupón aplicado { codigo, descuento }
  const [cuponMsg, setCuponMsg] = useState("");
  const [validandoCupon, setValidandoCupon] = useState(false);

  async function consultarCupon(codigo) {
    const { data, error: e } = await supabase.rpc("validar_cupon", { p_codigo: codigo, p_subtotal: total, p_telefono: telefono.trim() });
    if (e || !data) return { ok: false, mensaje: "No pudimos validar el cupón. Probá de nuevo." };
    return data;
  }

  async function aplicarCupon() {
    const codigo = cuponCodigo.trim();
    if (!codigo || validandoCupon) return;
    setValidandoCupon(true);
    setCuponMsg("");
    try {
      const r = await consultarCupon(codigo);
      if (r.ok) {
        setCupon({ codigo: r.codigo, descuento: Number(r.descuento) || 0 });
        setCuponMsg("");
      } else {
        setCupon(null);
        setCuponMsg(r.mensaje || "Cupón no válido.");
      }
    } catch (e) {
      setCuponMsg("No pudimos validar el cupón. Probá de nuevo.");
    }
    setValidandoCupon(false);
  }

  // Si cambia el total o el teléfono, el cupón aplicado se vuelve a comprobar.
  useEffect(() => {
    if (!cupon) return;
    let activo = true;
    const t = setTimeout(async () => {
      try {
        const r = await consultarCupon(cupon.codigo);
        if (!activo) return;
        if (r.ok) setCupon({ codigo: r.codigo, descuento: Number(r.descuento) || 0 });
        else {
          setCupon(null);
          setCuponMsg(r.mensaje || "Cupón no válido.");
        }
      } catch (e) {
        // se mantiene
      }
    }, 500);
    return () => {
      activo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, telefono]);

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
  const descuentoCupon = cupon ? Math.min(cupon.descuento, total) : 0;
  const totalFinal = total - descuentoCupon + costoFinal;

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
          cupon: cupon ? cupon.codigo : null,
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
      if (errPedido && /cupon/i.test(String(errPedido.message || errPedido))) {
        setCupon(null);
        setCuponMsg(String(errPedido.message).replace(/^.*cupon:\s*/i, "") || "El cupón ya no es válido.");
        setEnviando(false);
        return setError("El cupón no se pudo usar. Revisalo y volvé a enviar el pedido.");
      }
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
      cupon ? `Cupón ${cupon.codigo}: -${money(descuentoCupon)}` : null,
      lineaEntrega,
      costoFinal > 0 || cupon ? `Total a pagar: ${money(totalFinal)}` : null,
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
          <button onClick={cerrar} className="mt-3 w-full h-14 rounded-2xl bg-[var(--acento)] text-[var(--sobre-acento)] font-bold">
            Seguir comprando
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fundir fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={cerrar}>
      <div className="subir bg-white w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-8 pb-4 border-b border-[var(--borde)] z-10">
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
              <div className="h-full bg-[var(--acento)] rounded-full transition-all" style={{ width: `${progreso * 100}%` }} />
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
                  <button onClick={() => quitar(l.id)} className="text-xs text-[var(--tinta-suave)] underline mt-1 py-1" aria-label={`Eliminar ${l.row.nombre}`}>
                    Eliminar
                  </button>
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
                    className="flex-1 h-11 rounded-xl bg-[var(--acento)] text-[var(--sobre-acento)] text-sm font-semibold"
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

            <div className="mt-3">
              {!cuponAbierto && !cupon ? (
                <button type="button" onClick={() => setCuponAbierto(true)} className="text-sm font-semibold text-[var(--verde)] underline">
                  ¿Tenés un cupón de descuento?
                </button>
              ) : cupon ? (
                <div className="flex items-center justify-between rounded-xl bg-[var(--verde-claro)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--verde)]">✓ Cupón {cupon.codigo} aplicado</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCupon(null);
                      setCuponCodigo("");
                      setCuponMsg("");
                    }}
                    className="text-sm text-[var(--tinta-suave)] underline"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={cuponCodigo}
                      onChange={(e) => setCuponCodigo(e.target.value.toUpperCase())}
                      placeholder="Código del cupón"
                      autoCapitalize="characters"
                      className="flex-1 min-w-0 h-12 px-4 rounded-xl border border-[var(--borde)] bg-white outline-none focus:border-[var(--verde)] text-base"
                    />
                    <button
                      type="button"
                      onClick={aplicarCupon}
                      disabled={validandoCupon || !cuponCodigo.trim()}
                      className="h-12 px-5 rounded-xl bg-[var(--acento)] text-[var(--sobre-acento)] font-bold disabled:opacity-50"
                    >
                      {validandoCupon ? "..." : "Aplicar"}
                    </button>
                  </div>
                </div>
              )}
              {cuponMsg && <p className="text-sm text-red-700 mt-1">{cuponMsg}</p>}
              {cupon && <p className="text-xs text-[var(--tinta-suave)] mt-1">El cupón se valida otra vez al enviar el pedido.</p>}
            </div>

            <div className="flex items-center justify-between mt-4 mb-3">
              <span className="text-sm text-[var(--tinta-suave)]">Total de productos</span>
              <span className="text-xl font-extrabold">{money(total)}</span>
            </div>
            {cupon && (
              <div className="flex items-center justify-between mb-3 -mt-1">
                <span className="text-sm text-[var(--tinta-suave)]">Descuento ({cupon.codigo})</span>
                <span className="font-bold text-[var(--verde)]">-{money(descuentoCupon)}</span>
              </div>
            )}
            {(costoFinal > 0 || cupon) && (
              <>
                {costoFinal > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--tinta-suave)]">Envío</span>
                    <span className="font-bold">{money(costoFinal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Total a pagar</span>
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
      className={`h-12 rounded-xl text-sm font-semibold border ${activo ? "bg-[var(--acento)] text-[var(--sobre-acento)] border-[var(--verde)]" : "bg-white border-[var(--borde)]"}`}
    >
      {children}
    </button>
  );
}
