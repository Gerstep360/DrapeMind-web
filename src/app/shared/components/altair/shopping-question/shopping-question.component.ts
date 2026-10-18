import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AiShoppingQuestion } from '@core/models/ai-presentation.models';

let questionSequence = 0;
@Component({
  selector: 'app-shopping-question',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <form [formGroup]="form" (ngSubmit)="submit()" class="shopping-question">
    @if (block.applied.length) {
      <p class="question-known">Ya tengo: {{ block.applied.join(' · ') }}</p>
    }
    <div class="question-fields">
      @for (field of block.fields; track field.key) {
        <div class="question-field">
          <label [for]="prefix + field.key"
            >{{ field.label }}
            @if (!field.required) {
              <span>Opcional</span>
            }
          </label>
          @if (field.kind === 'select') {
            <select [id]="prefix + field.key" [formControlName]="field.key">
              <option value="">Selecciona una opción</option>
              @for (option of field.options; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          } @else {
            <input
              [id]="prefix + field.key"
              [type]="field.kind"
              [formControlName]="field.key"
              maxlength="100"
              [attr.min]="field.kind === 'number' ? 0 : null"
              [attr.max]="field.kind === 'number' ? 1000000 : null"
              [attr.step]="field.kind === 'number' ? '0.01' : null"
            />
          }
          @if (form.controls[field.key].invalid && form.controls[field.key].touched) {
            <small class="question-error">Completa un valor válido.</small>
          }
        </div>
      }
    </div>
    <div class="question-submit">
      @if (submitted()) {
        <span role="status">Datos enviados.</span
        ><button type="button" (click)="submitted.set(false)">Editar criterios</button>
      } @else {
        <span>Continúa cuando esté listo.</span
        ><button type="submit" [disabled]="disabled || form.invalid">
          Buscar con estos datos <span aria-hidden="true">↗</span>
        </button>
      }
    </div>
  </form>`,
  styles: [
    `
      :host {
        display: block;
      }
      .shopping-question {
        padding: 16px;
      }
      .question-known {
        font-size: 11px;
        color: var(--dm-muted);
        line-height: 1.6;
        margin: 0 0 14px;
      }
      .question-fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
        gap: 14px;
        max-height: 40dvh;
        overflow: auto;
        padding: 3px;
      }
      label {
        display: block;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 7px;
      }
      label span {
        color: var(--dm-muted);
        font-size: 10px;
        font-weight: 400;
        margin-left: 5px;
      }
      input,
      select {
        width: 100%;
        min-height: 44px;
        border: 1px solid var(--dm-ink);
        border-radius: 4px;
        background: var(--dm-paper);
        color: var(--dm-ink);
        font: inherit;
        font-size: 13px;
        padding: 10px;
      }
      input:focus-visible,
      select:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--dm-ink);
        outline-offset: 2px;
      }
      .question-submit {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 18px;
      }
      .question-submit > span {
        font-size: 11px;
        color: var(--dm-muted);
      }
      button {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        min-height: 44px;
        align-items: center;
        padding: 10px 14px;
        border: 2px solid var(--dm-ink);
        border-radius: 4px;
        color: var(--dm-ink);
        background: var(--dm-lime);
        font: inherit;
        font-size: 12px;
        font-weight: 750;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .question-error {
        display: block;
        color: var(--dm-danger);
        font-size: 11px;
        margin-top: 5px;
      }
    `,
  ],
})
export class ShoppingQuestionComponent implements OnChanges {
  @Input({ required: true }) block!: AiShoppingQuestion;
  @Input() disabled = false;
  @Output() confirmed = new EventEmitter<string>();
  readonly prefix = 'shopping-question-' + ++questionSequence + '-';
  readonly submitted = signal(false);
  form = new FormGroup<Record<string, FormControl<string>>>({});
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.block || !changes['block']) return;
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.block.fields) {
      const validators = [Validators.maxLength(100)];
      if (field.required)
        validators.push(Validators.required, (control) =>
          String(control.value ?? '').trim() ? null : { required: true },
        );
      if (field.kind === 'number')
        validators.push(
          Validators.min(0),
          Validators.max(1000000),
          Validators.pattern(/^\d+(\.\d{1,2})?$/),
        );
      if (field.kind === 'select')
        validators.push((control) =>
          !control.value || field.options.some((o) => o.value === control.value)
            ? null
            : { option: true },
        );
      controls[field.key] = new FormControl(field.value, { nonNullable: true, validators });
    }
    this.form = new FormGroup(controls);
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (this.disabled || this.form.invalid || this.submitted()) return;
    const values = Object.fromEntries(
      Object.entries(this.form.getRawValue())
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v !== ''),
    );
    this.confirmed.emit(
      'Continúa ahora la solicitud con los datos confirmados. El formulario ya está completado. Solicitud original: ' +
        this.block.request +
        '\nDatos confirmados por mí para esta consulta (' +
        this.block.goal +
        '): ' +
        JSON.stringify(values),
    );
    this.submitted.set(true);
  }
}
