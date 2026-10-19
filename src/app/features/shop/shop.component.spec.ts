import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShopComponent } from './shop.component';

describe('ShopComponent', () => {
  let fixture: ComponentFixture<ShopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ShopComponent] }).compileComponents();
    fixture = TestBed.createComponent(ShopComponent);
    fixture.detectChanges();
  });

  it('shows the gold catalog by default with purchases disabled', () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('.shop-product').length).toBe(6);
    expect(page.querySelectorAll('.product-price:disabled').length).toBe(6);
    expect(page.textContent).toContain('100K');
    expect(page.textContent).toContain('20,000');
    expect(page.textContent).toContain('Catalog preview');
  });

  it('switches between diamond bundles and VIP item durations', () => {
    const page = fixture.nativeElement as HTMLElement;
    const tabs = page.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;

    tabs[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('diamonds');
    expect(page.querySelectorAll('.shop-product').length).toBe(6);
    expect(page.textContent).toContain('Bonus Diamond Bundles');
    expect(page.textContent).toContain('1,560');

    tabs[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('items');
    expect(page.querySelectorAll('.shop-product').length).toBe(9);
    expect(page.textContent).toContain('Bronze Card');
    expect(page.textContent).toContain('365 days');
  });

  it('emits close when the back button is clicked', () => {
    const closeSpy = jasmine.createSpy('close');
    fixture.componentInstance.close.subscribe(closeSpy);
    (fixture.nativeElement.querySelector('.shop-back') as HTMLButtonElement).click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
