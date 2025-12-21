import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { ImagePickerResult, PostImage } from '../types';

export interface ImagePickerOptions {
  mediaType?: 'photo' | 'video' | 'mixed';
  allowsMultipleSelection?: boolean;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
}

export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

// Request permissions for image picker
export const requestImagePickerPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }
  return true;
};

export const requestCameraPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }
  return true;
};

// Pick image from gallery
export const pickImageFromGallery = async (options: ImagePickerOptions = {}): Promise<ImagePickerResult[]> => {
  const hasPermission = await requestImagePickerPermissions();
  if (!hasPermission) {
    throw new Error('Permission to access camera roll is required!');
  }

  const defaultOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: options.allowsMultipleSelection || false,
    quality: options.quality || 0.8,
    allowsEditing: options.allowsEditing || true,
    aspect: options.aspect || [4, 3],
    base64: true
  };

  const result = await ImagePicker.launchImageLibraryAsync(defaultOptions);

  if (result.canceled || !result.assets) {
    return [];
  }

  return result.assets.map(asset => ({
    base64: asset.base64 || '',
    width: asset.width,
    height: asset.height,
    size: asset.base64 ? asset.base64.length : 0
  }));
};

// Take photo with camera
export const takePhoto = async (options: ImagePickerOptions = {}): Promise<ImagePickerResult | null> => {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) {
    throw new Error('Permission to access camera is required!');
  }

  const defaultOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: options.quality || 0.8,
    allowsEditing: options.allowsEditing || true,
    aspect: options.aspect || [4, 3],
    base64: true
  };

  const result = await ImagePicker.launchCameraAsync(defaultOptions);

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    base64: asset.base64 || '',
    width: asset.width,
    height: asset.height,
    size: asset.base64 ? asset.base64.length : 0
  };
};

// Compress image to base64
export const compressImage = (
  base64: string, 
  options: CompressionOptions = { maxWidth: 800, maxHeight: 600, quality: 0.8 }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      const { maxWidth, maxHeight } = options;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      const compressedBase64 = canvas.toDataURL('image/jpeg', options.quality);
      
      // Remove data:image/jpeg;base64, prefix
      const base64Data = compressedBase64.split(',')[1];
      resolve(base64Data);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    // Add data URL prefix if not present
    const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    img.src = dataUrl;
  });
};

// Validate image size (in bytes)
export const validateImageSize = (base64: string, maxSizeInMB: number = 5): boolean => {
  const sizeInBytes = (base64.length * 3) / 4; // Approximate size of base64
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB <= maxSizeInMB;
};

// Get image dimensions from base64
export const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Add data URL prefix if not present
    const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    img.src = dataUrl;
  });
};

// Convert base64 to PostImage format
export const createPostImage = async (base64: string): Promise<PostImage> => {
  const dimensions = await getImageDimensions(base64);
  
  return {
    data: base64.startsWith('data:') ? base64.split(',')[1] : base64,
    width: dimensions.width,
    height: dimensions.height,
    size: base64.length
  };
};

// Batch process multiple images
export const processImages = async (
  base64Images: string[],
  compressionOptions?: CompressionOptions
): Promise<PostImage[]> => {
  const processedImages: PostImage[] = [];

  for (const base64 of base64Images) {
    try {
      let processedBase64 = base64;
      
      // Compress if options provided
      if (compressionOptions) {
        processedBase64 = await compressImage(base64, compressionOptions);
      }

      // Validate size (max 5MB)
      if (!validateImageSize(processedBase64)) {
        // If still too large, compress more aggressively
        processedBase64 = await compressImage(base64, {
          maxWidth: 600,
          maxHeight: 400,
          quality: 0.6
        });
      }

      const postImage = await createPostImage(processedBase64);
      processedImages.push(postImage);
    } catch (error) {
      console.error('Error processing image:', error);
      // Skip invalid images
    }
  }

  return processedImages;
};

// Generate image preview URL from base64
export const createImagePreviewUrl = (base64: string): string => {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:image/jpeg;base64,${base64}`;
};

// Calculate storage size for images
export const calculateImagesSize = (images: PostImage[]): number => {
  return images.reduce((total, image) => total + image.size, 0);
};

// Format image size for display
export const formatImageSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
};

// Create thumbnail from image
export const createThumbnail = async (
  base64: string, 
  maxSize: number = 150
): Promise<string> => {
  return compressImage(base64, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    quality: 0.7
  });
};

// Resize image to specific dimensions
export const resizeImage = (
  base64: string,
  targetWidth: number,
  targetHeight: number,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx?.drawImage(img, 0, 0, targetWidth, targetHeight);
      const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
      
      // Remove data:image/jpeg;base64, prefix
      const base64Data = resizedBase64.split(',')[1];
      resolve(base64Data);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };

    // Add data URL prefix if not present
    const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    img.src = dataUrl;
  });
};

// Check if image is landscape or portrait
export const getImageOrientation = (width: number, height: number): 'landscape' | 'portrait' | 'square' => {
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
};

// Create image grid layout data
export const createImageGridLayout = (images: PostImage[]): { layout: string; images: PostImage[] } => {
  const count = images.length;
  
  if (count === 0) return { layout: 'none', images: [] };
  if (count === 1) return { layout: 'single', images };
  if (count === 2) return { layout: 'double', images };
  if (count === 3) return { layout: 'triple', images };
  if (count === 4) return { layout: 'quad', images };
  
  // For more than 4 images, show first 4 with a "+X more" indicator
  return { layout: 'quad-plus', images: images.slice(0, 4) };
};

// Image optimization presets
export const IMAGE_PRESETS = {
  thumbnail: { maxWidth: 150, maxHeight: 150, quality: 0.7 },
  small: { maxWidth: 400, maxHeight: 300, quality: 0.8 },
  medium: { maxWidth: 800, maxHeight: 600, quality: 0.8 },
  large: { maxWidth: 1200, maxHeight: 900, quality: 0.85 },
  profile: { maxWidth: 300, maxHeight: 300, quality: 0.9 }
};

// Apply preset compression
export const applyImagePreset = async (
  base64: string, 
  preset: keyof typeof IMAGE_PRESETS
): Promise<string> => {
  const options = IMAGE_PRESETS[preset];
  return compressImage(base64, options);
};

// Validate image format
export const isValidImageFormat = (base64: string): boolean => {
  const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  const formatMatch = dataUrl.match(/data:image\/(jpeg|jpg|png|gif|webp)/i);
  return formatMatch !== null;
};

// Extract image format from base64
export const getImageFormat = (base64: string): string => {
  if (base64.startsWith('data:image/')) {
    const match = base64.match(/data:image\/([^;]+)/);
    return match ? match[1] : 'jpeg';
  }
  return 'jpeg'; // Default format
};