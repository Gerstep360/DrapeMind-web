import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { GarmentCardComponent } from './garment-card.component';

describe('Compact verified garment pick', () => {
  it('keeps details and purchase as separate keyboard controls and blocks sold-out variants', () => {
    TestBed.configureTestingModule({
      imports: [GarmentCardComponent],
      providers: [
        { provide: RuntimeConfigService, useValue: { resolveImageUrl: (url: string) => url } },
      ],
    });
    const fixture = TestBed.createComponent(GarmentCardComponent);
    fixture.componentRef.setInput('item', {
      id: 7,
      variante_id: 2,
      nombre: 'Camisa real',
      precio: 175,
      talla: 'M',
      color: 'Negro',
      accion: 'AGREGAR',
      stock_disponible: 0,
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const details = root.querySelector<HTMLButtonElement>('.garment-pick__detail')!;
    const purchase = root.querySelector<HTMLButtonElement>('.garment-pick__action')!;
    expect(details.getAttribute('aria-label')).toContain('Camisa real');
    expect(details.textContent).toContain('175.00');
    expect(purchase.disabled).toBe(true);
    let opened = false;
    fixture.componentInstance.cardClick.subscribe(() => (opened = true));
    details.click();
    expect(opened).toBe(true);
  });
});
