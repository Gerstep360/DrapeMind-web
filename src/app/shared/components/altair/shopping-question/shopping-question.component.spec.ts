import { TestBed } from '@angular/core/testing';
import { ShoppingQuestionComponent } from './shopping-question.component';
import { AiShoppingQuestion } from '@core/models/ai-presentation.models';

const question: AiShoppingQuestion = {
  type: 'shopping_question',
  source_tool: 'ask_shopping_preferences',
  title: 'Tu presupuesto',
  goal: 'budget',
  request: 'Busca más prendas para mí.',
  applied: ['Talla superior: M'],
  fields: [
    {
      key: 'budget',
      label: 'Presupuesto (Bs)',
      kind: 'number',
      value: '',
      required: true,
      options: [],
    },
  ],
};
describe('Shopping clarification without extra messages', () => {
  it('waits for valid confirmation and emits one complete request', () => {
    const fixture = TestBed.createComponent(ShoppingQuestionComponent);
    fixture.componentRef.setInput('block', question);
    fixture.detectChanges();
    const messages: string[] = [];
    fixture.componentInstance.confirmed.subscribe((message) => messages.push(message));
    expect(messages).toEqual([]);
    fixture.componentInstance.submit();
    expect(messages).toEqual([]);
    fixture.componentInstance.form.controls['budget'].setValue('250.50');
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('"budget":"250.50"');
    expect(messages[0]).toContain('Busca más prendas para mí.');
  });
  it('retains the draft when request capacity changes and rejects negative amounts', () => {
    const fixture = TestBed.createComponent(ShoppingQuestionComponent);
    fixture.componentRef.setInput('block', question);
    fixture.detectChanges();
    fixture.componentInstance.form.controls['budget'].setValue('320');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls['budget'].value).toBe('320');
    fixture.componentInstance.form.controls['budget'].setValue('-1');
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });
});
