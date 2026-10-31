import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Check, ChevronDown, Leaf, Minus, Plus, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { apiRequest, formatPrice } from '../utils/storage.js';

const defaultStore = { name: 'Maison Verde', slug: 'maison-verde', whatsappNumber: '' };

function ProductTile({ product, addToCart }) {
  const soldOut = !product.stock;
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.image ? <img className="product-image" src={product.image} alt={product.name} loading="lazy" /> : <div className="product-image-placeholder"><Sparkles size={25} /></div>}
        <span className="product-category">{product.category}</span>
        <button className={`add-button ${soldOut ? 'add-button-disabled' : ''}`} onClick={() => addToCart(product)} disabled={soldOut} aria-label={`Add ${product.name} to your bag`}>
          {soldOut ? 'Sold out' : <><Plus size={19} /><span className="add-button-label">Add to bag</span></>}
        </button>
      </div>
      <div className="product-details">
        <div className="product-title-row"><h3>{product.name}</h3><span className="product-price">{formatPrice(product.price)}</span></div>
        <p>{product.description}</p>
        {product.ingredients && <span className="product-ingredients">{product.ingredients}</span>}
      </div>
    </article>
  );
}

function CartDrawer({ cart, onClose, onChange, store }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', note: '' });
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const items = Object.values(cart);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function checkout(event) {
    event.preventDefault();
    setError('');
    if (!items.length) return setError('Your bag is looking a little empty.');
    if (!store.whatsappNumber) return setError('WhatsApp ordering is not set up yet. Please contact the shop directly.');
    if (!customer.name.trim() || !customer.phone.trim()) {
      return setError('Add your name and phone number to continue.');
    }
    const lines = items.map(({ product, quantity }) => `• ${product.name} × ${quantity} — ${formatPrice(product.price * quantity)}`);
    const message = [
      `Hello ${store.name}! I'd like to place an order:`,
      '',
      ...lines,
      '',
      `Total: ${formatPrice(total)}`,
      `Name: ${customer.name.trim()}`,
      `Phone: ${customer.phone.trim()}`,
      customer.note.trim() ? `Note: ${customer.note.trim()}` : ''
    ].filter(Boolean).join('\n');
    const url = `https://wa.me/${store.whatsappNumber}?text=${encodeURIComponent(message)}`;
    const orderWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!orderWindow) return setError('Allow pop-ups to continue to WhatsApp, then try again.');
    setSubmitted(true);
  }

  return (
    <>
      <div className="drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div className="drawer-header">
            <div><span className="eyebrow">YOUR LITTLE FINDS</span><h2 id="cart-title">Your bag <span>({items.reduce((sum, item) => sum + item.quantity, 0)})</span></h2></div>
            <button className="icon-button" aria-label="Close bag" onClick={onClose}><X size={19} /></button>
          </div>
          {!items.length ? (
            <div className="empty-cart"><span className="empty-cart-icon"><ShoppingBag size={24} /></span><h3>Nothing in here just yet.</h3><p>There's something lovely waiting for you.</p><button className="button button-outline" onClick={onClose}>Explore the collection <ArrowRight size={15} /></button></div>
          ) : (
            <>
              <div className="cart-items">
                {items.map(({ product, quantity }) => (
                  <article className="cart-item" key={product.id}>
                    {product.image ? <img src={product.image} alt="" /> : <div className="cart-item-placeholder"><Sparkles size={18} /></div>}
                    <div className="cart-item-main">
                      <div className="cart-item-heading"><div><h3>{product.name}</h3><span>{formatPrice(product.price)}</span></div><button className="remove-button" aria-label={`Remove ${product.name}`} onClick={() => onChange(product, 0)}><X size={15} /></button></div>
                      <div className="quantity-control">
                        <button aria-label={`Decrease ${product.name} quantity`} onClick={() => onChange(product, quantity - 1)}><Minus size={13} /></button>
                        <span>{quantity}</span>
                        <button aria-label={`Increase ${product.name} quantity`} onClick={() => onChange(product, quantity + 1)} disabled={quantity >= product.stock}><Plus size={13} /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="drawer-checkout">
                <div className="subtotal-row"><span>Subtotal</span><strong>{formatPrice(total)}</strong></div>
                <p className="checkout-note">Shipping and delivery are arranged directly with the shop.</p>
                {submitted ? (
                  <div className="submitted-note"><Check size={17} /> Your order is ready in WhatsApp. Send the message to confirm.</div>
                ) : (
                  <form className="checkout-form" onSubmit={checkout}>
                    <label htmlFor="customer-name">Your name</label>
                    <input id="customer-name" autoComplete="name" required maxLength={100} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                    <label htmlFor="customer-phone">Phone number</label>
                    <input id="customer-phone" type="tel" autoComplete="tel" required maxLength={40} value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
                    <label htmlFor="customer-note">A note for the shop <span>(optional)</span></label>
                    <textarea id="customer-note" rows="2" maxLength={300} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} />
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <button className="button button-primary checkout-button" type="submit">Continue to WhatsApp <ArrowRight size={16} /></button>
                  </form>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

export default function StoreFront() {
  const { slug } = useParams();
  const [store, setStore] = useState(defaultStore);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [activeCategory, setActiveCategory] = useState('Everything');
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const storePath = slug ? `/api/store/${encodeURIComponent(slug)}` : '/api/store';

  useEffect(() => {
    let active = true;
    let events;
    setLoading(true);
    setSyncError('');
    setCart({});
    setActiveCategory('Everything');
    apiRequest(storePath)
      .then(({ store: storeInfo, products: items }) => {
        if (active) {
          setStore(storeInfo);
          setProducts(items);
          setError('');
          events = new EventSource(`/api/store/${encodeURIComponent(storeInfo.slug)}/events`);
          events.addEventListener('connected', () => {
            if (active) setSyncError('');
          });
          events.addEventListener('error', () => {
            if (active) setSyncError('Live updates are reconnecting. Refresh the shop if you need the latest availability.');
          });
          events.addEventListener('catalog', () => {
            apiRequest(storePath)
              .then(({ products: updatedProducts }) => {
                if (!active) return;
                setProducts(updatedProducts);
                setCart((current) => Object.fromEntries(
                  Object.entries(current).flatMap(([id, entry]) => {
                    const latest = updatedProducts.find((product) => product.id === id);
                    return latest?.stock
                      ? [[id, { product: latest, quantity: Math.min(entry.quantity, latest.stock) }]]
                      : [];
                  })
                ));
                setError('');
                setSyncError('');
              })
              .catch(() => {
                if (active) setSyncError('The latest shop updates could not be loaded. Please try refreshing.');
              });
          });
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      events?.close();
    };
  }, [storePath]);

  const categories = useMemo(() => ['Everything', ...new Set(products.map((product) => product.category))], [products]);
  const visibleProducts = activeCategory === 'Everything' ? products : products.filter((product) => product.category === activeCategory);
  const cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!categories.includes(activeCategory)) setActiveCategory('Everything');
  }, [activeCategory, categories]);

  function updateCart(product, quantity) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = { product, quantity: Math.min(quantity, product.stock) };
      return next;
    });
  }

  return (
    <div className="storefront">
      <div className="announcement"><Sparkles size={13} /> A little more thoughtful. A little more you. <span>Free delivery on orders over $75</span></div>
      <Navbar storeName={store.name} cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow hero-eyebrow"><span className="eyebrow-dot" /> GOOD THINGS, MADE WITH CARE</span>
            <h1>A softer kind<br />of <em>everyday.</em></h1>
            <p>Thoughtful little things for the everyday rituals that make a life feel like yours.</p>
            <a className="button button-dark hero-button" href="#collection">Find your something <ArrowDown size={16} /></a>
            <div className="hero-footnote"><span className="hero-footnote-line" /> A small, slow collection. Made to be lived with.</div>
          </div>
          <div className="hero-art">
            <div className="hero-image hero-image-back"><img src="https://images.unsplash.com/photo-1600428853876-fb5a850b444f?auto=format&fit=crop&w=960&q=85" alt="" /></div>
            <div className="hero-image hero-image-front"><img src="https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=85" alt="Botanical oils arranged for an evening ritual" /></div>
            <div className="hero-note"><span>01</span><span>THE SLOW<br />LIVING EDIT</span></div>
            <div className="hero-stamp"><span>SMALL BATCH</span><span>♡</span><span>BIG HEART</span></div>
          </div>
          <div className="hero-side-note">OBJECTS FOR A WELL-LIVED LIFE · EST. WITH LOVE</div>
        </section>

        <section className="promise-strip" aria-label="Our values">
          <div><span className="promise-icon"><Sparkles size={16} /></span><span>Thoughtfully made</span></div>
          <span className="promise-divider" />
          <div><span className="promise-icon"><Leaf size={16} /></span><span>Kind to the everyday</span></div>
          <span className="promise-divider" />
          <div><span className="promise-icon"><Check size={16} /></span><span>Made in small batches</span></div>
        </section>

        <section className="collection section-container" id="collection">
          <div className="collection-heading">
            <div><span className="eyebrow">GOOD THINGS, GATHERED</span><h2>A few of our <em>favourites.</em></h2></div>
            <p>Collected slowly. Made to become part<br className="desktop-break" /> of your every day.</p>
          </div>
          <div className="collection-toolbar">
            <div className="category-filters" aria-label="Filter by category">
              {categories.map((category) => <button key={category} className={activeCategory === category ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => setActiveCategory(category)}>{category}</button>)}
            </div>
            <span className="product-count">{loading ? 'Finding good things…' : `${visibleProducts.length.toString().padStart(2, '0')} LITTLE FINDS`}</span>
          </div>
          {syncError && <p className="sync-error" role="status">{syncError}</p>}
          {error ? (
            <div className="state-card"><span className="state-icon"><X size={19} /></span><h3>We couldn't open the shop.</h3><p>{error}</p><button className="button button-outline" onClick={() => window.location.reload()}>Try again</button></div>
          ) : loading ? (
            <div className="product-grid product-grid-skeleton">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><span /><div /><div /></div>)}</div>
          ) : visibleProducts.length ? (
            <div className="product-grid">
              {visibleProducts.map((product) => <ProductTile key={product.id} product={product} addToCart={(item) => updateCart(item, (cart[item.id]?.quantity || 0) + 1)} />)}
            </div>
          ) : (
            <div className="state-card"><span className="state-icon"><Sparkles size={20} /></span><h3>Something lovely is on its way.</h3><p>There aren't any available pieces in the collection just yet.</p></div>
          )}
        </section>

        <section className="closing-note">
          <span className="eyebrow">A LITTLE NOTE FROM US</span>
          <h2>For the ordinary days<br />that turn out to be <em>everything.</em></h2>
          <p>Thank you for choosing small, thoughtful things. It means the world to us.</p>
          <span className="closing-flower">✳</span>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark"><Leaf size={16} /></span><span>{store.name}<small>MADE WITH INTENTION</small></span></div>
        <span>Made thoughtfully, just for you.</span>
        <Link to="/login">Owner's studio <ChevronDown size={13} className="footer-arrow" /></Link>
      </footer>
      {cartOpen && <CartDrawer cart={cart} onClose={() => setCartOpen(false)} onChange={updateCart} store={store} />}
    </div>
  );
}