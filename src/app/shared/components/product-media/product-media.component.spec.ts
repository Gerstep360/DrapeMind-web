import { TestBed } from '@angular/core/testing';
import { ProductMediaComponent } from './product-media.component';
import { RuntimeConfigService } from '@core/runtime-config.service';

describe('Unified product photography', () => {
  it('replaces a broken photo without SVG and retries when the source changes', () => {
    TestBed.configureTestingModule({
      imports: [ProductMediaComponent],
      providers: [
        {
          provide: RuntimeConfigService,
          useValue: { resolveImageUrl: (url: unknown) => url || null },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProductMediaComponent);
    fixture.componentRef.setInput('src', '/first.jpg');
    fixture.componentRef.setInput('label', 'Camisa');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin fotografía');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    fixture.componentRef.setInput('src', '/second.jpg');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/second.jpg');
  });
});
