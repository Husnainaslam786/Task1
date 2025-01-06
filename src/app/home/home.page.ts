import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { IonContent, IonButton, IonModal, IonTextarea, IonList } from '@ionic/angular/standalone';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserFormComponent } from '../form/form.component';

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent, IonButton, IonModal, IonTextarea, CommonModule, IonList, FormsModule,
     ReactiveFormsModule ,UserFormComponent],
})
export class HomePage implements OnInit {
  myForm: FormGroup;
  isModalOpen = false;
  description = '';
  capturedImages: string[] = [];
  selectedExcelFiles: File[] = [];
  excelData: any[] = [];
  selectedImage: string | null = null;

  constructor(private fb: FormBuilder) {
    this.myForm = this.fb.group({
      name: ['', Validators.required], 
      fatherName: ['', Validators.required],
      image: [null,Validators.required] 
    });
  }

  ngOnInit() {}

  setOpen(isOpen: boolean) {
    this.isModalOpen = isOpen;
  }

  removeImages(index: number) {
    this.capturedImages.splice(index, 1);
  }

  removeExcelFile(index: number) {
    this.selectedExcelFiles.splice(index, 1);
    this.excelData.splice(index, 1);
  }

  onImageSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImage = e.target.result;
        this.myForm.patchValue({ image: file }); 
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    // if (this.myForm.valid) {
      // const formData = this.myForm.value; 
      console.log('Form Data:',this.myForm.value);
    // } else {
      // console.log('Form is invalid');
    // }
  }

  async selectedImages() {
    try {
      const result = await Camera.pickImages({ quality: 90 });
      const newImages = result.photos.map(photo => photo.webPath || '');
      this.capturedImages = [...this.capturedImages, ...newImages];
    } catch (error) {
      console.error('Error:', error);
    }
  }

  onFileChange(event: any) {
    const files: FileList = event.target.files;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const binaryData = e.target?.result;
        const workbook = XLSX.read(binaryData, { type: 'binary' });

        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
        data.forEach((row: any, index: number) => {
          console.log(`Row ${index + 1}:`, row);
          if (row.Image) {
            console.log(`Image for Row ${index + 1}:`, row.Image);
            const imagePreview = document.createElement('img');
            imagePreview.src = row.Image;
            imagePreview.style.maxWidth = '200px';
            imagePreview.style.maxHeight = '200px';
            console.log(`Image Preview for Row ${index + 1}:`, imagePreview);
          }
        });

        this.selectedExcelFiles.push(file);
        this.excelData.push(data);
      };
      reader.readAsBinaryString(file);
    });
  }

  private generatePDF(): Blob {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imageWidth = 150;
    const imageHeight = 100;
    const imageMargin = 20;
    let yPosition = 20;

    pdf.setFontSize(16);
    pdf.text('Generated PDF', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    if (this.description) {
      pdf.setFontSize(12);
      const description = pdf.splitTextToSize(this.description, pageWidth - 2 * margin);
      pdf.text(description, margin, yPosition);
      yPosition += 20;
    }

    this.capturedImages.forEach((imageData) => {
      if (yPosition + imageHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.addImage(imageData, 'JPEG', (pageWidth - imageWidth) / 2, yPosition, imageWidth, imageHeight);
      yPosition += imageHeight + imageMargin;
    });

    this.excelData.forEach((data, index) => {
      if (yPosition + 20 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.setFontSize(12);
      pdf.text(`Excel File ${index + 1}:`, margin, yPosition);
      yPosition += 10;
      data.forEach((row: any) => {
        if (yPosition + 10 > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(JSON.stringify(row), margin, yPosition);
        yPosition += 10;
      });
    });

    return pdf.output('blob');
  }

  async generateAndShare() {
    try {
      const pdfBlob = this.generatePDF();
      const fileName = `images-and-excel-${Date.now()}.pdf`;

      if (Capacitor.getPlatform() === 'web') {
        const data = new DataTransfer();
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        data.items.add(file);

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'PDF with Images and Excel',
          });
        } else {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(pdfBlob);
          link.download = fileName;
          link.click();
        }
      } else {
        const base64 = await this.blobToBase64(pdfBlob);
        await Filesystem.writeFile({
          path: fileName,
          data: base64.split(',')[1],
          directory: Directory.Cache,
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'PDF with Images and Excel',
          url: Capacitor.getPlatform() === 'android' ? fileUri.uri : `file://${fileUri.uri}`,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
