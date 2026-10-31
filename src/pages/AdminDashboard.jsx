import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, Camera, Check, CheckCircle2, ImagePlus, LayoutGrid, Leaf, MapPin, MoreHorizontal, PackageCheck, Phone, Plus, Search, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import ImageCaptureModal from '../components/ImageCaptureModal.jsx';
import Navbar from '../components/Navbar.jsx';
import { completeOrder, createProduct, updateProduct, deleteOrder, deleteProduct as removeProduct, subscribeToOrders, subscribeToProducts, compressCanvas, formatPrice } from '../utils/storage.js';

const emptyForm = { name: '', price: '', description: '', ingredients: '', category: '', image: '', stock: 1, available: true };

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file to continue.'));
    if (file.size > 15_000_000) return reject(new Error('That file is too large. Choose an image under 15 MB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image. Please try another file.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That image could not be opened. Please try a different file.'));
      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Could not prepare that image.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        try {
          resolve(compressCanvas(canvas));
        } catch (error) {
          reject(error);
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ProductForm({ initial, onSave, onClose, saving, formError }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [showCamera, setShowCamera] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileRef = useRef(null);

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    try {
      const image = await compressImage(file);
      setForm((current) => ({ ...current, image }));
    } catch (error) {
      setImageError(error.message);
    }
  }

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <>
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
          <div className="modal-heading">
            <div><span className="eyebrow">{initial?.id ? 'A LITTLE UPDATE' : 'A NEW LITTLE FIND'}</span><h2 id="product-form-title">{initial?.id ? 'Edit your piece' : 'Add something lovely'}</h2></div>
            <button className="icon-button" aria-label="Close form" onClick={onClose}><X size={19} /></button>
          </div>
          <div className="product-form-layout">
            <form className="product-form" onSubmit={submit}>
              <label className="image-upload" htmlFor="product-image">
                {form.image ? <img src={form.image} alt="Product preview" /> : <span className="upload-prompt"><ImagePlus size={22} /><span>Add a product photo</span><small>JPG, PNG or WebP · compressed automatically</small></span>}
                <input ref={fileRef} id="product-image" type="file" accept="image/*" onChange={selectFile} />
              </label>
              <div className="image-actions">
                <button type="button" className="button button-outline button-small" onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> Upload image</button>
                <button type="button" className="button button-outline button-small" onClick={() => setShowCamera(true)}><Camera size={15} /> Take a photo</button>
                {form.image && <button type="button" className="button button-quiet button-small" onClick={() => setForm({ ...form, image: '' })}>Remove</button>}
              </div>
              {(imageError || formError) && <p className="form-error" role="alert">{imageError || formError}</p>}
              <div className="form-fields">
                <label htmlFor="product-name">Product name</label>
                <input id="product-name" required maxLength={100} placeholder="e.g. Sunday morning mug" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <div className="field-pair">
                  <div><label htmlFor="product-price">Price</label><div className="input-prefix"><span>$</span><input id="product-price" type="number" min="0" max="1000000" step="0.01" required placeholder="0.00" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></div></div>
                  <div><label htmlFor="product-stock">Available stock</label><input id="product-stock" type="number" min="0" max="1000000" step="1" required value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></div>
                </div>
                <label htmlFor="product-category">Category</label>
                <input id="product-category" required maxLength={60} placeholder="e.g. Home, Body care" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                <label htmlFor="product-description">A little about it</label>
                <textarea id="product-description" required maxLength={500} rows="3" placeholder="What makes this piece special?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                <label htmlFor="product-ingredients">Materials or ingredients <span>(optional)</span></label>
                <input id="product-ingredients" maxLength={300} placeholder="A few lovely details" value={form.ingredients} onChange={(event) => setForm({ ...form, ingredients: event.target.value })} />
                <label className="availability-toggle"><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} /><span><strong>Available in the shop</strong><small>Customers can find and order this piece.</small></span></label>
              </div>
              <div className="product-form-footer"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Publish this piece'} {!saving && <ArrowUpRight size={16} />}</button></div>
            </form>
            <aside className="live-preview">
              <span className="eyebrow">A LITTLE PREVIEW</span>
              <article className="product-card preview-product">
                <div className="product-image-wrap">
                  {form.image ? <img className="product-image" src={form.image} alt="" /> : <div className="product-image-placeholder"><Sparkles size={25} /></div>}
                  {form.category && <span className="product-category">{form.category}</span>}
                  <span className="add-button preview-add-button"><Plus size={19} /></span>
                </div>
                <div className="product-details"><div className="product-title-row"><h3>{form.name || 'Your product name'}</h3><span className="product-price">{formatPrice(Number(form.price) || 0)}</span></div><p>{form.description || 'A little description, just for your piece.'}</p>{form.ingredients && <span className="product-ingredients">{form.ingredients}</span>}</div>
              </article>
              <p className="preview-help"><Sparkles size={14} /> This is how it will look on your storefront.</p>
            </aside>
          </div>
        </section>
      </div>
      {showCamera && <ImageCaptureModal onClose={() => setShowCamera(false)} onCapture={(image) => { setForm({ ...form, image }); setShowCamera(false); }} />}
    </>
  );
}

function OrdersModal({ orders, loading, error, busyOrderId, onComplete, onDelete, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="orders-modal" role="dialog" aria-modal="true" aria-labelledby="orders-title">
        <div className="modal-heading">
          <div><span className="eyebrow">CUSTOMER ORDERS</span><h2 id="orders-title">Orders <span className="orders-total">{orders.length}</span></h2></div>
          <button className="icon-button" aria-label="Close orders" onClick={onClose}><X size={19} /></button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? (
          <div className="admin-loading"><span className="spinner" /> Gathering your orders…</div>
        ) : !orders.length ? (
          <div className="orders-empty"><span className="state-icon"><CheckCircle2 size={20} /></span><h3>All caught up.</h3><p>New customer orders will appear here.</p></div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className={`order-card ${order.status === 'completed' ? 'order-card-completed' : ''}`} key={order.id}>
                <div className="order-card-heading">
                  <div><h3>{order.customerName || 'Customer'}</h3><span>{order.timestamp?.toDate ? order.timestamp.toDate().toLocaleString() : 'Just received'}</span></div>
                  <span className={`order-status ${order.status === 'completed' ? 'order-status-completed' : ''}`}><span />{order.status === 'completed' ? 'Completed' : 'New'}</span>
                </div>
                <div className="order-contact"><a href={`tel:${encodeURIComponent(order.phoneNumber || '')}`}><Phone size={14} />{order.phoneNumber || 'No phone provided'}</a><p><MapPin size={14} />{order.location || 'No location provided'}</p></div>
                <div className="order-items">
                  {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                    <div className="order-item" key={`${order.id}-${index}`}>
                      {item.image ? <img src={item.image} alt="" /> : <span className="order-item-placeholder"><ShoppingBag size={15} /></span>}
                      <span className="order-item-name">{item.name || 'Product'}</span>
                      <span className="order-item-quantity">× {item.quantity}</span>
                      <strong>{formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
                    </div>
                  ))}
                </div>
                <div className="order-card-footer">
                  <strong>Total {formatPrice(Number(order.total) || 0)}</strong>
                  <div>
                    {order.status !== 'completed' && <button className="button button-outline button-small" disabled={busyOrderId === order.id} onClick={() => onComplete(order)}><Check size={14} /> Complete</button>}
                    <button className="icon-button delete-action" disabled={busyOrderId === order.id} onClick={() => onDelete(order)} aria-label={`Delete order from ${order.customerName || 'customer'}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminDashboard({ onSignOut, authError }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All pieces');
  const [notice, setNotice] = useState('');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState('');

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    return subscribeToProducts((items) => {
      setProducts(items);
      setLoading(false);
      setLoadError('');
    }, (error) => {
      setLoading(false);
      setLoadError(error.message);
    });
  }, [reloadKey]);

  useEffect(() => subscribeToOrders((items) => {
    setOrders(items);
    setOrdersLoading(false);
    setOrdersError('');
  }, (error) => {
    setOrdersLoading(false);
    setOrdersError(error.message);
  }), []);

  const newOrdersCount = orders.filter((order) => order.status === 'pending').length;
  const availableCount = products.filter((product) => product.available && product.stock > 0).length;
  const inventoryValue = products.reduce((sum, product) => sum + product.price * product.stock, 0);
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All pieces' || (filter === 'Available' ? product.available : !product.available);
    return matchesSearch && matchesFilter;
  }), [products, search, filter]);

  function openForm(product = null) {
    setEditing(product);
    setFormError('');
    setModalOpen(true);
  }

  async function saveProduct(form) {
    setSaving(true);
    setFormError('');
    try {
      if (editing) await updateProduct(editing.id, form);
      else await createProduct(form);
      setModalOpen(false);
      setNotice(editing ? 'Your changes are saved.' : 'Your new piece is live in the shop.');
      window.setTimeout(() => setNotice(''), 3500);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(product) {
    try {
      await updateProduct(product.id, { ...product, available: !product.available });
    } catch (error) {
      setNotice(error.message);
      window.setTimeout(() => setNotice(''), 3500);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Remove "${product.name}" from your collection? This cannot be undone.`)) return;
    try {
      await removeProduct(product.id);
      setNotice('Piece removed from your collection.');
      window.setTimeout(() => setNotice(''), 3500);
    } catch (error) {
      setNotice(error.message);
      window.setTimeout(() => setNotice(''), 3500);
    }
  }

  async function markOrderCompleted(order) {
    setBusyOrderId(order.id);
    try {
      await completeOrder(order.id);
    } catch (error) {
      setNotice(error.message);
      window.setTimeout(() => setNotice(''), 3500);
    } finally {
      setBusyOrderId('');
    }
  }

  async function removeOrder(order) {
    if (!window.confirm(`Delete the order from "${order.customerName || 'this customer'}"? This cannot be undone.`)) return;
    setBusyOrderId(order.id);
    try {
      await deleteOrder(order.id);
    } catch (error) {
      setNotice(error.message);
      window.setTimeout(() => setNotice(''), 3500);
    } finally {
      setBusyOrderId('');
    }
  }

  return (
    <div className="admin-page">
      <Navbar admin storeName="Owner's studio" onSignOut={onSignOut} notificationCount={newOrdersCount} onOpenOrders={() => setOrdersOpen(true)} />
      <main className="admin-main">
        <div className="admin-welcome">
          <div><span className="eyebrow"><span className="eyebrow-dot" /> YOUR LITTLE CORNER OF THE INTERNET</span><h1>Good morning,<br className="mobile-break" /> shopkeeper.</h1><p>A little snapshot of your store, right now.</p></div>
          <button className="button button-primary" onClick={() => openForm()}><Plus size={17} /> Add a piece</button>
        </div>
        {authError && <p className="form-error" role="alert">{authError}</p>}
        {notice && <div className="toast-message" role="status"><Check size={16} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
        <section className="stats-grid" aria-label="Store overview">
          <article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-sage"><LayoutGrid size={17} /></span><span className="stat-label">IN YOUR COLLECTION</span></div><strong>{products.length.toString().padStart(2, '0')}</strong><span className="stat-foot">pieces in your shop</span></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-peach"><PackageCheck size={17} /></span><span className="stat-label">READY TO FIND A HOME</span></div><strong>{availableCount.toString().padStart(2, '0')}</strong><span className="stat-foot">pieces available now</span></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-blue"><ShoppingBag size={17} /></span><span className="stat-label">ON YOUR SHELVES</span></div><strong>{formatPrice(inventoryValue)}</strong><span className="stat-foot">estimated inventory value</span></article>
        </section>

        <section className="inventory-section">
          <div className="inventory-heading"><div><span className="eyebrow">YOUR GOOD THINGS</span><h2>The collection <span>{products.length}</span></h2></div><button className="button button-primary button-mobile-add" onClick={() => openForm()}><Plus size={16} /> Add a piece</button></div>
          <div className="inventory-toolbar">
            <label className="search-field"><Search size={16} /><input type="search" placeholder="Find a piece…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products" /></label>
            <label className="filter-select"><ArrowDownUp size={14} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter products"><option>All pieces</option><option>Available</option><option>Hidden</option></select></label>
          </div>
          {loadError ? <div className="state-card"><h3>We couldn't load your collection.</h3><p>{loadError}</p><button className="button button-outline" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div> : loading ? <div className="admin-loading"><span className="spinner" /> Gathering your good things…</div> : !filteredProducts.length ? (
            <div className="state-card"><span className="state-icon"><Leaf size={20} /></span><h3>{products.length ? 'Nothing matches just now.' : 'A blank canvas.'}</h3><p>{products.length ? 'Try another search or filter.' : 'Your first little find is just a button away.'}</p>{!products.length && <button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Add your first piece</button>}</div>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead><tr><th>THE PIECE</th><th>PRICE</th><th>STOCK</th><th>VISIBILITY</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td><div className="table-product">{product.image ? <img src={product.image} alt="" /> : <span className="table-product-placeholder"><Sparkles size={16} /></span>}<div><strong>{product.name}</strong><span>{product.category}</span></div></div></td>
                    <td className="table-price">{formatPrice(product.price)}</td>
                    <td><span className={product.stock ? 'stock-count' : 'stock-count stock-none'}>{product.stock || 'Out of stock'}</span></td>
                    <td><button className={`status-pill ${product.available ? 'status-live' : 'status-hidden'}`} onClick={() => toggleAvailability(product)} aria-label={`${product.available ? 'Hide' : 'Show'} ${product.name}`}><span />{product.available ? 'In shop' : 'Hidden'}</button></td>
                    <td><div className="row-actions"><button className="icon-button" onClick={() => openForm(product)} aria-label={`Edit ${product.name}`}><MoreHorizontal size={18} /></button><button className="icon-button delete-action" onClick={() => deleteProduct(product)} aria-label={`Delete ${product.name}`}><Trash2 size={16} /></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
        <div className="admin-footnote"><span className="brand-mark"><Leaf size={15} /></span> Small things, thoughtfully done.</div>
      </main>
      {modalOpen && <ProductForm key={editing?.id || 'new-product'} initial={editing} onSave={saveProduct} onClose={() => setModalOpen(false)} saving={saving} formError={formError} />}
      {ordersOpen && <OrdersModal orders={orders} loading={ordersLoading} error={ordersError} busyOrderId={busyOrderId} onComplete={markOrderCompleted} onDelete={removeOrder} onClose={() => setOrdersOpen(false)} />}
    </div>
  );
}