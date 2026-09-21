import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Output,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScannerComponent {
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('scannerDialog');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private jsQrLib: any = null;

  readonly cameraSupported = signal(true);
  readonly isScanning = signal(false);
  readonly cameraError = signal<string | null>(null);

  @Output() decoded = new EventEmitter<string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopCamera());
  }

  private async loadJsQr(): Promise<any> {
    if (!this.jsQrLib) {
      const m = await import('jsqr');
      this.jsQrLib = (m as any).default || m;
    }
    return this.jsQrLib;
  }

  async open(): Promise<void> {
    this.cameraError.set(null);
    void this.loadJsQr();
    this.dialog()?.nativeElement.showModal();
    await this.startCamera();
  }

  close(): void {
    this.stopCamera();
    this.dialog()?.nativeElement.close();
  }

  async startCamera(): Promise<void> {
    this.stopCamera();
    if (!navigator?.mediaDevices?.getUserMedia) {
      this.showCameraFallback(
        'Cámara en vivo no disponible. Puedes capturar una foto o subir una imagen del QR.',
      );
      return;
    }

    try {
      this.cameraSupported.set(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.mediaStream = stream;
      const video = this.video()?.nativeElement;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      this.isScanning.set(true);
      this.scanVideoFrame();
    } catch {
      this.showCameraFallback(
        'No se pudo acceder a la cámara. Usa “Tomar foto / Subir imagen” para leer el QR.',
      );
    }
  }

  stopCamera(): void {
    this.isScanning.set(false);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.decodeImageFile(file);
    input.value = '';
  }

  onPaste(event: ClipboardEvent): void {
    const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
      item.type.startsWith('image/'),
    );
    const file = imageItem?.getAsFile();
    if (file) this.decodeImageFile(file);
  }

  private scanVideoFrame(): void {
    if (!this.isScanning() || !this.mediaStream) return;
    const video = this.video()?.nativeElement;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const code = this.decodeCanvas(video, video.videoWidth, video.videoHeight, 'dontInvert');
      if (code) {
        this.complete(code);
        return;
      }
    }
    this.animationFrameId = requestAnimationFrame(() => this.scanVideoFrame());
  }

  private decodeImageFile(file: File): void {
    const reader = new FileReader();
    reader.onload = async (event) => {
      await this.loadJsQr();
      const image = new Image();
      image.onload = () => {
        const code = this.decodeCanvas(
          image,
          image.naturalWidth || image.width,
          image.naturalHeight || image.height,
          'attemptBoth',
        );
        if (code) this.complete(code);
        else
          this.toast.show(
            'No se detectó un QR. Intenta con una imagen más cercana y enfocada.',
            'error',
          );
      };
      image.src = String(event.target?.result ?? '');
    };
    reader.readAsDataURL(file);
  }

  private decodeCanvas(
    source: CanvasImageSource,
    width: number,
    height: number,
    inversionAttempts: 'dontInvert' | 'attemptBoth',
  ): string | null {
    if (!width || !height || !this.jsQrLib) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    return this.jsQrLib(imageData.data, width, height, { inversionAttempts })?.data ?? null;
  }

  private complete(raw: string): void {
    const token = this.extractToken(raw);
    this.close();
    this.decoded.emit(token);
  }

  private extractToken(raw: string): string {
    const token = raw.trim();
    try {
      const url = new URL(token);
      return (
        url.searchParams.get('token') || url.pathname.split('/').filter(Boolean).pop() || token
      );
    } catch {
      return token;
    }
  }

  private showCameraFallback(message: string): void {
    this.cameraSupported.set(false);
    this.cameraError.set(message);
  }
}
