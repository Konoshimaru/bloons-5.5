import os
import fitz  # PyMuPDF

def convert_svg_to_png():
    # 🌟 FIX: This forces Python to look in the script's actual folder,
    # even when you launch it by double-clicking!
    current_dir = os.path.dirname(os.path.abspath(__file__))
    count = 0
    
    print(f"📁 Looking for SVGs in: {current_dir}")
    print("🔍 Scanning for SVG files...")
    
    for file_name in os.listdir(current_dir):
        if file_name.lower().endswith('.svg'):
            svg_path = os.path.join(current_dir, file_name)
            png_name = os.path.splitext(file_name)[0] + '.png'
            png_path = os.path.join(current_dir, png_name)
            
            print(f"Converting: {file_name} -> {png_name} (5x Scale, Transparent)")
            
            try:
                doc = fitz.open(svg_path)
                page = doc[0]
                
                mat = fitz.Matrix(5, 5)
                pix = page.get_pixmap(matrix=mat, alpha=True)
                
                pix.save(png_path)
                doc.close()
                count += 1
            except Exception as e:
                print(f"❌ Failed to convert {file_name}. Error: {e}")
                
    print(f"\n✨ Done! Successfully converted {count} SVG(s) to transparent 5x PNGs.")

if __name__ == "__main__":
    try:
        convert_svg_to_png()
    except Exception as e:
        print(f"\n💥 A critical error occurred: {e}")
    
    input("\nPress Enter to exit...")
