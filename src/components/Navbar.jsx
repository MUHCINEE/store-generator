import { ArrowUpRight, Bell, Leaf, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar({ storeName, storeSlug, cartCount = 0, onOpenCart, admin = false, onSignOut, notificationCount = 0, onOpenOrders }) {
  const publicStorePath = storeSlug ? `/store/${encodeURIComponent(storeSlug)}` : '/';
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="brand-mark"><Leaf size={17} strokeWidth={1.8} /></span>
        <span>{storeName || 'Maison Verde'}<small>MADE WITH INTENTION</small></span>
      </Link>
      {admin ? (
        <nav className="header-actions">
          <Link className="header-link" to={publicStorePath}>View store <ArrowUpRight size={15} /></Link>
          <button className="notification-button" type="button" onClick={onOpenOrders} aria-label={`Open orders, ${notificationCount} new`}>
            <Bell size={18} />
            {notificationCount > 0 && <span className="notification-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}
          </button>
          <button className="button button-quiet header-signout" onClick={onSignOut}>Sign out</button>
        </nav>
      ) : (
        <nav className="header-actions">
          <a className="header-link desktop-link" href="#collection">Shop collection</a>
          <button className="cart-button" aria-label={`Open cart, ${cartCount} items`} onClick={onOpenCart}>
            <ShoppingBag size={18} strokeWidth={1.8} />
            <span>Bag</span><span className="cart-count">{cartCount}</span>
          </button>
        </nav>
      )}
    </header>
  );
}