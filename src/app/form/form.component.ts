import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';


@Component({
  schemas:[CUSTOM_ELEMENTS_SCHEMA],
  selector: 'app-user-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
  imports:[ReactiveFormsModule,CommonModule]
})
export class UserFormComponent {
  form!: FormGroup;
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  submitting = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      fatherName: ['', Validators.required],
      image: [null, Validators.required]
    });
  }

  onImageChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedImage = file;
      const reader = new FileReader();
      reader.onload = (e) => this.imagePreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  onSubmit(): void {
    this.submitting = true;
    if (this.form.valid) {
      const formValues = this.form.value;
      console.log('Name:', formValues.name);
      console.log('Father Name:', formValues.fatherName);
      console.log('Image:', this.selectedImage ? this.selectedImage.name : 'No image selected');
    }
    this.submitting = false;
  }
}