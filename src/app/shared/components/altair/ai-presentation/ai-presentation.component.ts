import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { ShoppingQuestionComponent } from '../shopping-question/shopping-question.component';
import { RouterLink } from '@angular/router';
import { AiDataBlock, readAiDataBlocks } from '@core/models/ai-presentation.models';

@Component({
  selector: 'app-ai-presentation',
  standalone: true,
  imports: [RouterLink, ShoppingQuestionComponent],
  templateUrl: './ai-presentation.component.html',
  styleUrl: './ai-presentation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPresentationComponent {
  @Input() disabled = false;
  @Output() answerQuestion = new EventEmitter<string>();
  @Input() blocks: AiDataBlock[] = [];
  get views(): AiDataBlock[] {
    return readAiDataBlocks(this.blocks);
  }
}
