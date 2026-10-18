import { TestBed } from '@angular/core/testing';
import { ToolActivityComponent } from './tool-activity.component';

describe('Altair visible tool progress', () => {
  it('shows the running query and then its real result, with an accessible disclosure', () => {
    const fixture = TestBed.createComponent(ToolActivityComponent);
    fixture.componentRef.setInput('pending', true);
    fixture.componentRef.setInput('trace', [
      { name: 'Buscando prendas', state: 'running', startedAt: Date.now() },
    ]);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Buscando prendas');
    expect(root.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
    fixture.componentRef.setInput('pending', false);
    fixture.componentRef.setInput('trace', [
      {
        name: 'Buscando prendas',
        state: 'done',
        startedAt: Date.now(),
        summary: '2 resultados disponibles',
      },
    ]);
    fixture.detectChanges();
    expect(root.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    root.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.activity-reveal')?.getAttribute('aria-hidden')).toBe('false');
    expect(root.textContent).toContain('2 resultados disponibles');
  });
});
