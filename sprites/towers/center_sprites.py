import os
from PIL import Image

def center_and_resize_image(file_path, target_size=(1000, 1000)):
    try:
        with Image.open(file_path) as img:
            # Força conversão para RGBA para não perder a transparência
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Carrega os píxeis na memória para podermos analisar o canal Alfa (transparência)
            pixels = img.load()
            width, height = img.size
            
            # Encontra as bordas do conteúdo visível ignorando píxeis quase totalmente transparentes (Alpha <= 10)
            min_x, max_x = width, 0
            min_y, max_y = height, 0
            has_content = False
            
            for y in range(height):
                for x in range(width):
                    r, g, b, a = pixels[x, y]
                    if a > 10:  # Encontrou pixel visível
                        if x < min_x: min_x = x
                        if x > max_x: max_x = x
                        if y < min_y: min_y = y
                        if y > max_y: max_y = y
                        has_content = True
            
            if not has_content:
                print(f"Ignorado (totalmente transparente): {file_name}")
                return

            # Recorta a caixa delimitadora real do macaco
            cropped_img = img.crop((min_x, min_y, max_x + 1, max_y + 1))
            
            # Cria um canvas novo e limpo de 1000x1000 totalmente transparente
            new_img = Image.new("RGBA", target_size, (0, 0, 0, 0))
            
            # Calcula a posição para colar o recorte exatamente no meio do novo quadrado
            crop_w, crop_h = cropped_img.size
            paste_x = (target_size[0] - crop_w) // 2
            paste_y = (target_size[1] - crop_h) // 2
            
            # Cola o conteúdo centralizado usando o próprio recorte como máscara de Alpha
            new_img.paste(cropped_img, (paste_x, paste_y), cropped_img)
            
            # Fecha a imagem original antes de gravar por cima para evitar trancar o ficheiro no Windows
            img.close()
            
            # Remove o ficheiro antigo e grava o novo com o tamanho final correto
            os.remove(file_path)
            new_img.save(file_path, "PNG")
            print(f"Sucesso: {os.path.basename(file_path)} | Conteúdo real: {crop_w}x{crop_h} -> Centrado em 1000x1000")
            
    except Exception as e:
        print(f"Erro ao processar {os.path.basename(file_path)}: {e}")

def main():
    # os.getcwd() agarra a pasta exata onde o script está a ser executado
    current_dir = os.getcwd()
    print(f"A processar imagens na pasta atual: {current_dir}\n")
    
    count = 0
    for file_name in os.listdir(current_dir):
        # Filtra apenas ficheiros PNG da pasta atual e ignora o próprio script
        if file_name.lower().endswith('.png') and file_name != 'center_sprites.py':
            file_path = os.path.join(current_dir, file_name)
            center_and_resize_image(file_path)
            count += 1
            
    print(f"\nConcluído! {count} imagens processadas diretamente nesta pasta.")

if __name__ == "__main__":
    main()
