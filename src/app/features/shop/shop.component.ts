import { Component, EventEmitter, Output, signal } from '@angular/core';

export type ShopTab = 'gold' | 'diamonds' | 'items';

export interface ShopProduct {
  id: string;
  title: string;
  amount: string;
  bonus?: string;
  duration?: string;
  price: string;
  priceCurrency: 'diamonds' | 'usd';
  artwork: 'gold' | 'diamond' | 'bronze' | 'silver' | 'gold-vip';
}

@Component({
  selector: 'app-shop',
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css'
})
export class ShopComponent {
  @Output() readonly close = new EventEmitter<void>();
  readonly activeTab = signal<ShopTab>('gold');

  readonly goldProducts: ShopProduct[] = [
    { id: 'gold-100k', title: 'Gold', amount: '100K', price: '10', priceCurrency: 'diamonds', artwork: 'gold' },
    { id: 'gold-500k', title: 'Gold', amount: '500K', price: '50', priceCurrency: 'diamonds', artwork: 'gold' },
    { id: 'gold-3m', title: 'Gold', amount: '3M', price: '300', priceCurrency: 'diamonds', artwork: 'gold' },
    { id: 'gold-10m', title: 'Gold', amount: '10M', price: '1,000', priceCurrency: 'diamonds', artwork: 'gold' },
    { id: 'gold-50m', title: 'Gold', amount: '50M', price: '5,000', priceCurrency: 'diamonds', artwork: 'gold' },
    { id: 'gold-200m', title: 'Gold', amount: '200M', price: '20,000', priceCurrency: 'diamonds', artwork: 'gold' }
  ];

  readonly diamondProducts: ShopProduct[] = [
    { id: 'diamonds-120', title: 'Diamonds', amount: '120', bonus: '60', price: '$0.99', priceCurrency: 'usd', artwork: 'diamond' },
    { id: 'diamonds-600', title: 'Diamonds', amount: '600', bonus: '300', price: '$4.99', priceCurrency: 'usd', artwork: 'diamond' },
    { id: 'diamonds-1560', title: 'Diamonds', amount: '1,560', bonus: '780', price: '$12.99', priceCurrency: 'usd', artwork: 'diamond' },
    { id: 'diamonds-2440', title: 'Diamonds', amount: '2,440', bonus: '1,220', price: '$19.99', priceCurrency: 'usd', artwork: 'diamond' },
    { id: 'diamonds-6000', title: 'Diamonds', amount: '6,000', bonus: '3,000', price: '$49.99', priceCurrency: 'usd', artwork: 'diamond' },
    { id: 'diamonds-13000', title: 'Diamonds', amount: '13,000', bonus: '6,500', price: '$99.99', priceCurrency: 'usd', artwork: 'diamond' }
  ];

  readonly itemProducts: ShopProduct[] = [
    { id: 'vip-bronze-30', title: 'Bronze Card', amount: 'VIP', duration: '30 days', price: '299', priceCurrency: 'diamonds', artwork: 'bronze' },
    { id: 'vip-silver-30', title: 'Silver Card', amount: 'VIP', duration: '30 days', price: '599', priceCurrency: 'diamonds', artwork: 'silver' },
    { id: 'vip-gold-30', title: 'Gold Card', amount: 'VIP', duration: '30 days', price: '1,299', priceCurrency: 'diamonds', artwork: 'gold-vip' },
    { id: 'vip-bronze-90', title: 'Bronze Card', amount: 'VIP', duration: '90 days', price: '849', priceCurrency: 'diamonds', artwork: 'bronze' },
    { id: 'vip-silver-90', title: 'Silver Card', amount: 'VIP', duration: '90 days', price: '1,799', priceCurrency: 'diamonds', artwork: 'silver' },
    { id: 'vip-gold-90', title: 'Gold Card', amount: 'VIP', duration: '90 days', price: '3,499', priceCurrency: 'diamonds', artwork: 'gold-vip' },
    { id: 'vip-bronze-365', title: 'Bronze Card', amount: 'VIP', duration: '365 days', price: '2,999', priceCurrency: 'diamonds', artwork: 'bronze' },
    { id: 'vip-silver-365', title: 'Silver Card', amount: 'VIP', duration: '365 days', price: '5,999', priceCurrency: 'diamonds', artwork: 'silver' },
    { id: 'vip-gold-365', title: 'Gold Card', amount: 'VIP', duration: '365 days', price: '10,999', priceCurrency: 'diamonds', artwork: 'gold-vip' }
  ];

  get activeProducts(): ShopProduct[] {
    switch (this.activeTab()) {
      case 'diamonds': return this.diamondProducts;
      case 'items': return this.itemProducts;
      default: return this.goldProducts;
    }
  }

  productLabel(product: ShopProduct): string {
    const duration = product.duration ? ` ${product.duration}` : '';
    return `${product.title} ${product.amount}${duration}, ${product.price} ${product.priceCurrency}, preview only`;
  }

  selectTab(tab: ShopTab): void {
    this.activeTab.set(tab);
  }
}
