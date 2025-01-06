import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonModal } from '@ionic/angular/standalone';
import { Camera, GalleryPhoto } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  standalone: true,
  selector: 'app-modal',
  templateUrl: 'modal.component.html',
  styleUrls:['modal.component.scss'],
  imports: [CommonModule, FormsModule, IonModal],
})
export class ModalComponent {
  isModalOpen = false;
  selectedImages: string[] = [];
  description: string = '';

  setOpen(isOpen: boolean) {
    this.isModalOpen = isOpen;
  }

  async openGallery() {
    try {
      const result = await Camera.pickImages({
        quality: 90,
        limit: 5, // Maximum number of images to select
      });

      this.selectedImages = result.photos.map((photo: GalleryPhoto) => photo.webPath || '');
    } catch (error) {
      console.error('Error selecting images', error);
    }
  }

  removeImage(index: number) {
    this.selectedImages.splice(index, 1);
  }

  async sharePdf() {
    if (this.selectedImages.length === 0) {
      console.error('No images selected');
      return;
    }

    const pdf = new jsPDF();

    // Add selected images to the PDF
    for (let i = 0; i < this.selectedImages.length; i++) {
      const imgData = this.selectedImages[i];

      const image = await this.loadImage(imgData);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const aspectRatio = image.width / image.height;
      const imgWidth = pageWidth - 20; // Add some margin
      const imgHeight = imgWidth / aspectRatio;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
    }

    // Save the PDF to a local file
    const fileName = 'selected-images.pdf';
    const pdfBlob = pdf.output('blob'); // Create a Blob object from the PDF
    const fileUri = await this.savePdfToFileSystem(pdfBlob, fileName);

    // Share the PDF file
    try {
      await Share.share({
        title: 'Selected Images PDF',
        text: this.description || 'Here is the PDF of selected images.',
        url: fileUri,
        dialogTitle: 'Share PDF',
      });
    } catch (error) {
      console.error('Error sharing PDF', error);
    }
  }

  async savePdfToFileSystem(pdfBlob: Blob, fileName: string): Promise<string> {
    const base64Pdf = await this.blobToBase64(pdfBlob);
    await Filesystem.writeFile({
      path: fileName,
      data: base64Pdf,
      directory: Directory.Documents,
    });

    const fileUri = (await Filesystem.getUri({
      directory: Directory.Documents,
      path: fileName,
    })).uri;

    return fileUri;
  }

  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }
}
