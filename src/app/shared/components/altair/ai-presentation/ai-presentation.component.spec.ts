import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AiPresentationComponent } from './ai-presentation.component';
import { readAiDataBlocks } from '@core/models/ai-presentation.models';

describe('Verified prefabricated chat UI', () => {
  it('renders comparisons as a semantic table with actual values', () => {
    TestBed.configureTestingModule({
      imports: [AiPresentationComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(AiPresentationComponent);
    fixture.componentRef.setInput('blocks', [
      {
        type: 'data_table',
        title: 'Comparación',
        source_tool: 'compare_products',
        columns: [
          { key: 'name', label: 'Prenda' },
          { key: 'price', label: 'Precio' },
        ],
        rows: [{ name: 'Camisa real', price: 'Bs 175.00' }],
        empty_message: 'Sin resultados',
      },
    ]);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('th').length).toBe(2);
    expect(root.querySelector('td')?.textContent).toBe('Camisa real');
    expect(root.textContent).toContain('Bs 175.00');
    expect(root.querySelector('pre')).toBeNull();
  });
  it('renders policy content as plain text and rejects unknown views and routes', () => {
    TestBed.configureTestingModule({
      imports: [AiPresentationComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(AiPresentationComponent);
    fixture.componentRef.setInput('blocks', [
      {
        type: 'information',
        title: 'Envíos',
        source_tool: 'get_store_policy',
        body: '<img src=x onerror=alert(1)>',
        tone: 'neutral',
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img');
    expect(readAiDataBlocks([{ type: 'html', body: '<script>' }])).toEqual([]);
    expect(
      readAiDataBlocks([
        {
          type: 'status_list',
          title: 'x',
          source_tool: 'x',
          items: [],
          route: 'https://example.com',
          empty_message: 'x',
        },
      ]),
    ).toEqual([]);
  });
});
