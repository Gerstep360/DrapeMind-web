import { TestBed } from '@angular/core/testing';
import { ChatComposerComponent } from './chat-composer.component';
import { ToastService } from '@core/toast.service';

describe('Altair composer tools', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ChatComposerComponent],
      providers: [{ provide: ToastService, useValue: { show: () => undefined } }],
    }),
  );

  it('opens real actions and lets the customer review a search before sending', () => {
    const fixture = TestBed.createComponent(ChatComposerComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('[aria-label="Abrir herramientas"]')!.click();
    fixture.detectChanges();
    const search = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.toolbox-grid button'),
    ).find((button) => button.textContent?.includes('Buscar prendas'))!;
    let goal = '';
    fixture.componentInstance.openShoppingSetup.subscribe((value) => (goal = value));
    search.click();
    fixture.detectChanges();
    expect(goal).toBe('discover');
    expect(fixture.componentInstance.prompt.value).toBe('');
    expect(root.querySelector('.composer-toolbox')).toBeNull();
    expect(root.querySelector<HTMLTextAreaElement>('textarea')?.disabled).toBe(false);
  });

  it('disables the reactive control at capacity and enables it when space becomes available', () => {
    const fixture = TestBed.createComponent(ChatComposerComponent);
    fixture.componentRef.setInput('isBusy', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.prompt.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('textarea').disabled).toBe(true);
    fixture.componentRef.setInput('isBusy', false);
    fixture.detectChanges();
    expect(fixture.componentInstance.prompt.enabled).toBe(true);
  });
});
