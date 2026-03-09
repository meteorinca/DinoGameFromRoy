"""
Crop sprites from dinoSprites.png - V4 (Precise manual coordinates)

Based on visual inspection of the 640x640 image with debug grid:
- Sprites are pixel art, so we can define tight regions per sprite
- All text labels are removed by making non-sprite pixels transparent
"""

from PIL import Image
import os


def crop_sprite_tight(img, search_region, name, output_dir, color_filter="green"):
    """
    Crop a sprite from the image.
    1. Search within the given region for non-white pixels matching the color filter
    2. Get tight bounding box
    3. Make background transparent
    4. Save
    """
    x1, y1, x2, y2 = search_region
    pixels = img.load()
    
    min_x, min_y = x2, y2
    max_x, max_y = x1, y1
    
    for y in range(y1, min(y2, img.height)):
        for x in range(x1, min(x2, img.width)):
            r, g, b, a = pixels[x, y]
            
            if a < 20:
                continue
            if r > 240 and g > 240 and b > 240:
                continue
            
            keep = False
            
            if color_filter == "green":
                # Green pixels (dino body, cactus)
                if g > 50 and g >= r - 10:
                    keep = True
                # Red eye pixels
                if r > 100 and g < 80:
                    keep = True
                # Dark outline pixels near green
                if r < 80 and g < 80 and b < 80:
                    # Check neighbors for green (is this pixel adjacent to a green pixel?)
                    for dx, dy2 in [(-1,0),(1,0),(0,-1),(0,1),(-2,0),(2,0),(0,-2),(0,2)]:
                        nx, ny = x + dx, y + dy2
                        if 0 <= nx < img.width and 0 <= ny < img.height:
                            nr, ng, nb, na = pixels[nx, ny]
                            if ng > 80 and ng > nr:
                                keep = True
                                break
            elif color_filter == "dark":
                # Bird/dark sprites - accept any non-white pixel that's gray or colored
                brightness = (r + g + b) / 3
                if brightness < 200:
                    keep = True
            elif color_filter == "cloud":
                # Clouds are light gray (not pure white)
                brightness = (r + g + b) / 3
                if 120 < brightness < 248:
                    keep = True
            elif color_filter == "ground":
                # Ground: dark and brown pixels
                keep = True  # accept everything non-white
            
            if keep:
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
    
    if max_x < min_x:
        print(f"  ⚠ No pixels found: {name}")
        return False
    
    # Crop the region
    sprite = img.crop((min_x, min_y, max_x + 1, max_y + 1)).copy()
    sprite = sprite.convert("RGBA")
    sp = sprite.load()
    sw, sh = sprite.size
    
    # Make non-sprite pixels transparent
    for py in range(sh):
        for px in range(sw):
            r, g, b, a = sp[px, py]
            if a < 20:
                continue
            
            make_transparent = False
            
            if color_filter == "green":
                is_green = (g > 50 and g >= r - 10)
                is_red_eye = (r > 100 and g < 80)
                is_dark_near_green = False
                if r < 80 and g < 80 and b < 80:
                    # Check if adjacent to a colored pixel
                    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                        nx, ny = px + dx, py + dy
                        if 0 <= nx < sw and 0 <= ny < sh:
                            nr, ng, nb, na = sp[nx, ny]
                            if na > 20 and (ng > 80 and ng > nr):
                                is_dark_near_green = True
                                break
                
                if not (is_green or is_red_eye or is_dark_near_green):
                    if r > 235 and g > 235 and b > 235:
                        make_transparent = True
                    # Also make pure white transparent
                    elif r > 240 and g > 240 and b > 240:
                        make_transparent = True
                        
            # For all filters: make near-white pixels transparent
            if r > 240 and g > 240 and b > 240:
                make_transparent = True
            
            if make_transparent:
                sp[px, py] = (0, 0, 0, 0)
    
    path = os.path.join(output_dir, name)
    sprite.save(path)
    print(f"  ✓ {name} ({sw}x{sh})")
    return True


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    img = Image.open(os.path.join(base, "dinoSprites.png")).convert("RGBA")
    output_dir = os.path.join(base, "assets")
    os.makedirs(output_dir, exist_ok=True)
    
    W, H = img.size
    print(f"Source: {W}x{H}")
    
    # ===================================================================
    # PRECISE REGIONS based on debug grid analysis of 640x640 image
    # Each sprite gets its own precisely defined search box
    # ===================================================================
    
    # Row 1 dinos: text label ends around y=38, sprites start below
    # 5 sprites at x positions roughly: 0-128, 128-256, 256-384, 384-512, 512-640
    print("\n=== DINO SPRITES ===")
    crop_sprite_tight(img, (5, 42, 120, 128), "dino_run1.png", output_dir, "green")
    crop_sprite_tight(img, (130, 42, 250, 128), "dino_run2.png", output_dir, "green")
    crop_sprite_tight(img, (265, 42, 370, 128), "dino_jump.png", output_dir, "green")
    crop_sprite_tight(img, (385, 50, 510, 128), "dino_duck.png", output_dir, "green")
    crop_sprite_tight(img, (520, 60, 640, 128), "dino_dead.png", output_dir, "green")
    
    # Row 2 cacti: text "OBSTACLES" label ends around y=210, sprites below
    # 3 sprites: small cactus ~x 10-90, large cactus ~x 140-230, cluster ~x 290-480
    print("\n=== CACTUS SPRITES ===")
    crop_sprite_tight(img, (10, 215, 130, 295), "cactus_small.png", output_dir, "green")
    crop_sprite_tight(img, (130, 215, 280, 295), "cactus_large.png", output_dir, "green")
    crop_sprite_tight(img, (290, 215, 500, 295), "cactus_cluster.png", output_dir, "green")
    
    # Row 3 birds: text "PTERODACTYL BIRD" label ends around y=365, sprites below
    # 2 sprites: wings up ~x 15-130, wings down ~x 140-280
    print("\n=== PTERODACTYL SPRITES ===")
    crop_sprite_tight(img, (15, 365, 135, 430), "bird_up.png", output_dir, "dark")
    crop_sprite_tight(img, (135, 365, 280, 430), "bird_down.png", output_dir, "dark")
    
    # Row 4 clouds: sprites between y≈490 and y≈535
    # Clouds are spread across the width
    print("\n=== CLOUD SPRITES ===")
    # Text "BACKGROUND: Simple Clouds" ends around y=500
    crop_sprite_tight(img, (5, 500, 110, 545), "cloud_1.png", output_dir, "cloud")
    crop_sprite_tight(img, (120, 500, 230, 545), "cloud_2.png", output_dir, "cloud")
    crop_sprite_tight(img, (240, 500, 350, 545), "cloud_3.png", output_dir, "cloud")
    crop_sprite_tight(img, (360, 500, 450, 545), "cloud_4.png", output_dir, "cloud")
    crop_sprite_tight(img, (460, 500, 560, 545), "cloud_5.png", output_dir, "cloud")
    
    # Row 5: Ground strip y≈575-625
    # Text "Ground Texture Strip" ends around y=590
    print("\n=== GROUND STRIP ===")
    crop_sprite_tight(img, (0, 593, W, 630), "ground.png", output_dir, "ground")
    
    print(f"\n✅ All sprites saved to: {output_dir}")


if __name__ == "__main__":
    main()
