"""Cloudinary service for uploading images to cloud storage."""

import cloudinary
import cloudinary.uploader
from io import BytesIO
from PIL import Image
from typing import Optional


def configure_cloudinary(cloud_name: str, api_key: str, api_secret: str) -> None:
    """Configure Cloudinary with credentials."""
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True
    )


def upload_image(image: Image.Image, filename: str) -> Optional[str]:
    """
    Upload PIL Image to Cloudinary and return the secure URL.
    
    Args:
        image: PIL Image object
        filename: Original filename (used for public_id)
        
    Returns:
        Secure URL of uploaded image, or None if upload fails
    """
    try:
        # Convert PIL Image to bytes
        buffer = BytesIO()
        image_format = image.format or "JPEG"
        image.save(buffer, format=image_format)
        buffer.seek(0)
        
        # Upload to Cloudinary
        # public_id will be the filename without extension
        public_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
        
        result = cloudinary.uploader.upload(
            buffer,
            folder="product_descriptions",  # Organize images in a folder
            public_id=public_id,
            resource_type="image",
            overwrite=False,  # Don't overwrite if exists
            unique_filename=True,  # Add random suffix to make unique
        )
        
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading to Cloudinary: {e}")
        return None
