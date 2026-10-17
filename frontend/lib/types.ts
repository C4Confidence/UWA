export interface Product {
  _id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  quantity: number;
  color?: string;
  images: unknown[];
  ratings?: { star: number }[];
}

export interface Account {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  token: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
