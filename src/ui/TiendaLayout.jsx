// PATH: src/ui/TiendaLayout.jsx
import "../styles/tienda.css";

export default function TiendaLayout({ tienda, children }) {
  const nombre = tienda?.nombre || "Tienda";
  const logo = tienda?.branding?.logoUrl?.trim();
  const cover = tienda?.branding?.coverUrl?.trim();

  return (
    <div className="flyer" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
      {/* zona central (logo grande como flyer) */}
      <header className="flyerTop">
        {logo ? (
          <img className="flyerLogo" src={logo} alt={nombre} />
        ) : (
          <div className="flyerLogoPlaceholder">{nombre.slice(0, 1).toUpperCase()}</div>
        )}
      </header>

      {/* ✅ AHORA ESTO ES LO ÚNICO QUE SCROLLEA */}
      <main className="flyerMain">{children}</main>
    </div>
  );
}
