import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  orderBy,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { ensureFirebaseConfigured, getFirebaseApp } from '../firebase.js';

function getProductsCollection() {
  return collection(getFirestore(getFirebaseApp()), 'products');
}

function getOrdersCollection() {
  return collection(getFirestore(getFirebaseApp()), 'orders');
}

function firebaseError(error) {
  if (error?.code === 'permission-denied') {
    return new Error('You do not have permission to access the product collection. Check the Firestore security rules.');
  }
  if (error?.code === 'unavailable') {
    return new Error('Firestore is unavailable. Check your connection and try again.');
  }
  return new Error(error?.message || 'The product request could not be completed. Please try again.');
}

function productData(product) {
  return {
    name: product.name.trim(),
    price: Number(product.price),
    description: product.description.trim(),
    ingredients: (product.ingredients || '').trim(),
    category: product.category.trim(),
    image: product.image || '',
    stock: Number(product.stock),
    available: Boolean(product.available)
  };
}

export function subscribeToProducts(onProducts, onError) {
  try {
    ensureFirebaseConfigured();
    return onSnapshot(getProductsCollection(), (snapshot) => {
      const products = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0));
      onProducts(products);
    }, (error) => onError(firebaseError(error)));
  } catch (error) {
    onError(firebaseError(error));
    return () => {};
  }
}

export function subscribeToOrders(onOrders, onError) {
  try {
    ensureFirebaseConfigured();
    return onSnapshot(query(getOrdersCollection(), orderBy('timestamp', 'desc')), (snapshot) => {
      onOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => onError(firebaseError(error)));
  } catch (error) {
    onError(firebaseError(error));
    return () => {};
  }
}

export async function createOrder({ customerName, phoneNumber, location, items, storeSlug }) {
  ensureFirebaseConfigured();
  try {
    const order = {
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      location: location.trim(),
      items: items.map(({ product, quantity }) => ({
        name: product.name,
        image: product.image || '',
        price: Number(product.price),
        quantity: Number(quantity)
      })),
      total: items.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0),
      storeSlug,
      timestamp: serverTimestamp(),
      status: 'pending'
    };
    const reference = await addDoc(getOrdersCollection(), order);
    return reference.id;
  } catch (error) {
    throw firebaseError(error);
  }
}

export async function completeOrder(orderId) {
  ensureFirebaseConfigured();
  try {
    await updateDoc(doc(getFirestore(getFirebaseApp()), 'orders', orderId), {
      status: 'completed',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw firebaseError(error);
  }
}

export async function deleteOrder(orderId) {
  ensureFirebaseConfigured();
  try {
    await deleteDoc(doc(getFirestore(getFirebaseApp()), 'orders', orderId));
  } catch (error) {
    throw firebaseError(error);
  }
}

export async function createProduct(product) {
  ensureFirebaseConfigured();
  try {
    const reference = await addDoc(getProductsCollection(), {
      ...productData(product),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: reference.id, ...productData(product) };
  } catch (error) {
    throw firebaseError(error);
  }
}

export async function updateProduct(productId, product) {
  ensureFirebaseConfigured();
  try {
    await updateDoc(doc(getFirestore(getFirebaseApp()), 'products', productId), {
      ...productData(product),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw firebaseError(error);
  }
}

export async function deleteProduct(productId) {
  ensureFirebaseConfigured();
  try {
    await deleteDoc(doc(getFirestore(getFirebaseApp()), 'products', productId));
  } catch (error) {
    throw firebaseError(error);
  }
}

export function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function compressCanvas(canvas) {
  for (const quality of [0.78, 0.68, 0.58, 0.48]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= 900_000) return dataUrl;
  }
  throw new Error('That image is too large for Firestore. Choose a smaller image.');
}
