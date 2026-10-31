import { ArrowUpRight, Leaf, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Navbar({ storeName, cartCount = 0, onOpenCart, admin = false, onSignOut }) {
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="brand-mark"><Leaf size={17} strokeWidth={1.8} /></span>
        <span>{storeName || 'Maison Verde'}<small>MADE WITH INTENTION</small></span>
      </Link>
      {admin ? (
        <nav className="header-actions">
          <Link className="header-link" to="/">View store <ArrowUpRight size={15} /></Link>
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