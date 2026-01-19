// PATH: src/ui/TiendaLayout.jsx
import "../styles/tienda.css";

export default function TiendaLayout({ tienda, children }) {
  const nombre = tienda?.nombre || "Tienda";
  const logo = tienda?.branding?.logoUrl?.trim();
  const cover = tienda?.branding?.coverUrl?.trim();

  return (
    <div className="flyer" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
      {/* barra tipo WhatsApp */}
      {/* <div className="waTop">
        <button className="waBack" type="button" aria-label="Volver" onClick={() => window.history.back()}>
          ←
        </button>

        <div className="waAvatar">
          {logo ? <img src={logo} alt={nombre} /> : <div className="waAvatarPh">{nombre.slice(0,1).toUpperCase()}</div>}
        </div>

        <div className="waTitle">
          <div className="waName">{nombre}</div>
          <div className="waSub">Ayer, 19:44</div>
        </div>

        <button className="waMenu" type="button" aria-label="Menú">
          ⋮
        </button>
      </div> */}

      {/* zona central (logo grande como flyer) */}
      <header className="flyerTop">
        {logo ? (
          <img className="flyerLogo" src={logo} alt={nombre} />
        ) : (
          <div className="flyerLogoPlaceholder">{nombre.slice(0, 1).toUpperCase()}</div>
        )}
      </header>

      {/* contenido vidrio */}
      <main className="flyerMain">{children}</main>
    </div>
  );
}
