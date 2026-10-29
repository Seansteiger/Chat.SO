from PIL import Image, ImageDraw

def create_chat_icon(size, is_maskable=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s = size / 512.0
    
    pad = int(12 * s if is_maskable else 24 * s)
    radius = int(80 * s if is_maskable else 115 * s)
    
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(255, 255, 255, 255))
    
    # Premium Indigo-to-Violet gradient (#4f46e5 to #7c3aed)
    grad = Image.new('RGBA', (size, size))
    for y in range(size):
        ratio = y / float(size)
        r = int(79 * (1 - ratio) + 124 * ratio)
        g = int(70 * (1 - ratio) + 58 * ratio)
        b = int(229 * (1 - ratio) + 237 * ratio)
        for x in range(size):
            grad.putpixel((x, y), (r, g, b, 255))
            
    img.paste(grad, (0, 0), bg)
    
    # Chat bubble (white)
    bw = int(260 * s if is_maskable else 280 * s)
    bh = int(190 * s if is_maskable else 200 * s)
    bx0 = int((size - bw) / 2)
    by0 = int((size - bh) / 2 - 14 * s)
    bx1 = bx0 + bw
    by1 = by0 + bh
    bubble_radius = int(58 * s)
    
    bubble = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(bubble)
    b_draw.rounded_rectangle([bx0, by0, bx1, by1], radius=bubble_radius, fill=(255, 255, 255, 255))
    
    # Tail
    tail_pts = [
        (bx0 + int(48 * s), by1 - int(5 * s)),
        (bx0 + int(14 * s), by1 + int(46 * s)),
        (bx0 + int(100 * s), by1 - int(5 * s))
    ]
    b_draw.polygon(tail_pts, fill=(255, 255, 255, 255))
    b_draw.circle((bx0 + int(14 * s), by1 + int(46 * s)), radius=int(6 * s), fill=(255, 255, 255, 255))
    
    img.paste(bubble, (0, 0), bubble)
    
    # Three communication dots in Indigo
    dot_radius = int(18 * s)
    dot_y = int(by0 + bh / 2)
    cx = size / 2
    spacing = int(58 * s)
    
    dot_color = (79, 70, 229, 255) # Indigo
    draw = ImageDraw.Draw(img)
    draw.ellipse([cx - spacing - dot_radius, dot_y - dot_radius, cx - spacing + dot_radius, dot_y + dot_radius], fill=dot_color)
    draw.ellipse([cx - dot_radius, dot_y - dot_radius, cx + dot_radius, dot_y + dot_radius], fill=dot_color)
    draw.ellipse([cx + spacing - dot_radius, dot_y - dot_radius, cx + spacing + dot_radius, dot_y + dot_radius], fill=dot_color)
    
    return img

def create_monochrome_badge(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s = size / 96.0
    
    bw = int(68 * s)
    bh = int(50 * s)
    bx0 = int((size - bw) / 2)
    by0 = int((size - bh) / 2 - 4 * s)
    bx1 = bx0 + bw
    by1 = by0 + bh
    bubble_radius = int(16 * s)
    
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=bubble_radius, fill=(255, 255, 255, 255))
    
    tail_pts = [
        (bx0 + int(12 * s), by1 - int(2 * s)),
        (bx0 + int(2 * s), by1 + int(12 * s)),
        (bx0 + int(26 * s), by1 - int(2 * s))
    ]
    draw.polygon(tail_pts, fill=(255, 255, 255, 255))
    draw.circle((bx0 + int(2 * s), by1 + int(12 * s)), radius=int(2 * s), fill=(255, 255, 255, 255))
    
    dot_radius = int(4.5 * s)
    dot_y = int(by0 + bh / 2)
    cx = size / 2
    spacing = int(14 * s)
    
    draw.ellipse([cx - spacing - dot_radius, dot_y - dot_radius, cx - spacing + dot_radius, dot_y + dot_radius], fill=(0, 0, 0, 0))
    draw.ellipse([cx - dot_radius, dot_y - dot_radius, cx + dot_radius, dot_y + dot_radius], fill=(0, 0, 0, 0))
    draw.ellipse([cx + spacing - dot_radius, dot_y - dot_radius, cx + spacing + dot_radius, dot_y + dot_radius], fill=(0, 0, 0, 0))
    
    return img

print('Generating assets...')
im512 = create_chat_icon(512, is_maskable=False)
im512.save('apps/web/public/icons/icon-512.png', 'PNG')

im192 = im512.resize((192, 192), Image.Resampling.LANCZOS)
im192.save('apps/web/public/icons/icon-192.png', 'PNG')

im_mask512 = create_chat_icon(512, is_maskable=True)
im_mask512.save('apps/web/public/icons/icon-maskable-512.png', 'PNG')

im_mask192 = im_mask512.resize((192, 192), Image.Resampling.LANCZOS)
im_mask192.save('apps/web/public/icons/icon-maskable-192.png', 'PNG')

im_launch = create_chat_icon(1024, is_maskable=False)
im_launch.save('apps/web/public/icons/launch-icon.png', 'PNG')

badge96 = create_monochrome_badge(96)
badge96.save('apps/web/public/icons/badge-96.png', 'PNG')

badge72 = create_monochrome_badge(72)
badge72.save('apps/web/public/icons/badge-72.png', 'PNG')

apple_icon = im512.resize((180, 180), Image.Resampling.LANCZOS)
apple_icon.save('apps/web/public/apple-touch-icon.png', 'PNG')

fav32 = im512.resize((32, 32), Image.Resampling.LANCZOS)
fav32.save('apps/web/public/favicon.png', 'PNG')
fav32.save('apps/web/public/favicon.ico', format='ICO')

print('All branding and notification icons successfully regenerated!')
