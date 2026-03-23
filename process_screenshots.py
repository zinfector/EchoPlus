import os
from PIL import Image

TARGET_WIDTH = 1280
TARGET_HEIGHT = 800
TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT

folder = 'screenshots'
files = [f for f in os.listdir(folder) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

if not os.path.exists(os.path.join(folder, 'processed')):
    os.makedirs(os.path.join(folder, 'processed'))

for filename in files:
    filepath = os.path.join(folder, filename)
    try:
        img = Image.open(filepath)
        
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        img_width, img_height = img.size
        img_ratio = img_width / img_height
        
        if img_ratio > TARGET_RATIO:
            # Image is wider than target ratio. Fit height, crop width.
            new_height = TARGET_HEIGHT
            new_width = int(new_height * img_ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Center crop
            left = (new_width - TARGET_WIDTH) / 2
            top = 0
            right = left + TARGET_WIDTH
            bottom = TARGET_HEIGHT
            
        else:
            # Image is taller than target ratio. Fit width, crop height.
            new_width = TARGET_WIDTH
            new_height = int(new_width / img_ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Crop from the top (usually better for web screenshots)
            left = 0
            top = 0
            right = TARGET_WIDTH
            bottom = TARGET_HEIGHT
            
        img = img.crop((left, top, right, bottom))
        
        out_filepath = os.path.join(folder, 'processed', os.path.splitext(filename)[0] + '.png')
        img.save(out_filepath, 'PNG')
        print(f"Processed: {filename}")
        
    except Exception as e:
        print(f"Error processing {filename}: {e}")
