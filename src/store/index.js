import { uniqueId } from "../utils/id";
import { configureStore, createSlice } from "@reduxjs/toolkit";
const auth = createSlice({
  name: "auth",
  initialState: { user: null, loading: true },
  reducers: {
    setUser: (s, a) => {
      s.user = a.payload;
      s.loading = false;
    },
  },
});
const cart = createSlice({
  name: "cart",
  initialState: {
    items: [],
    type: "dine-in",
    table: "",
    customer: "",
    notes: "",
    deliveryAddress: "",
    discountCode: "",
    redeemPoints: 0,
    manualDiscount: 0,
  },
  reducers: {
    addItem: (s, a) => {
      s.items.push({ ...a.payload, key: uniqueId() });
    },
    updateItem: (s, a) => {
      const i = s.items.find((i) => i.key === a.payload.key);
      if (i) Object.assign(i, a.payload);
      s.items = s.items.filter((i) => i.quantity > 0);
    },
    setCart: (s, a) => ({ ...s, ...a.payload }),
    clearCart: () => ({
      items: [],
      type: "dine-in",
      table: "",
      customer: "",
      notes: "",
      deliveryAddress: "",
      discountCode: "",
      redeemPoints: 0,
      manualDiscount: 0,
    }),
  },
});
export const { setUser } = auth.actions;
export const { addItem, updateItem, setCart, clearCart } = cart.actions;
export const store = configureStore({
  reducer: { auth: auth.reducer, cart: cart.reducer },
});
